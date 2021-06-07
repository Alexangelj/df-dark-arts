/// @title  Dark Arts Plugin for Dark Forest v0.6
/// @author Alex Angel
/// @notice Sets local storage with labels of units and their id's
/// @dev    Fetches units using ids stored in local storage

// ===== IMPORTS =====

import { move } from 'https://plugins.zkga.me/utils/queued-move.js';

import {
    html,
    render,
    useState,
    useLayoutEffect,
    useCallback,
} from 'https://unpkg.com/htm/preact/standalone.module.js';

// ====== CONSTANTS ======

// === Values ===

const PIRATE = '0x0000000000000000000000000000000000000000';
const PERCENTAGE = 10000;
const DEFENSE = 100;

// === Unit Info ===

const UnitImage = {
    Blitz: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/au-kddi/190/high-voltage-sign_26a1.png',
    Feeders:
        'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/microsoft/209/battery_1f50b.png',
    Artillery:
        'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/samsung/265/bow-and-arrow_1f3f9.png',
    Railroads:
        'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/microsoft/209/train_1f686.png',
    None: 'https://images.emojiterra.com/twitter/v13.0/512px/1fa90.png',
};

// The indentifier key for units in local storage
const UNITS = 'Units';

// Used for plugin purposes
const UnitType = {
    Blitz: 0, // Blitz units have high speed, used to crawl through enemy territory. Less than lvl 4.
    Feeders: 1, // Feeder units have high energy capacity and defense, used to refill units
    Artillery: 2, // Artillery units have high range and used for final blows. Higher than or equal to lvl 4.
    Railroads: 3, // RailRoad units are specially designated to not engage in war and only move silver
    None: 55, // Set if no unit type selected
};

// Used for local storage
const UnitKey = {
    Blitz: 'Blitz',
    Feeders: 'Feeders',
    Artillery: 'Artillery',
    Railroads: 'Railroads',
    None: 'None',
};

// === Planet Info ===

const PlanetType = {
    Planet: 0,
    Asteroid: 1,
    Foundry: 2,
    SpaceRip: 3,
    Quasar: 4,
    None: 20,
};

const types = {
    PlanetLevel: {
        MAX: 4,
    },
};

// ============= Dark Arts Class =============

/// @notice Used for percentage related math
class Percentage {
    constructor(points) {
        this.val = points * PERCENTAGE;
    }

    get raw() {
        return this.val;
    }

    get points() {
        return this.val / PERCENTAGE;
    }
}

/// @notice Values to check when moving.
/// Energy threshold is the max energy to spend for a planet
/// Silver threshold is the max silver to spend for a planet
/// Attack threshold is the minimum % of energy taken from an enemy planet
/// Feed threshold is the minimum % of energy given to a friendly planet
const ThresholdTypes = {
    Energy: 'Energy',
    Attack: 'Attack',
    Feed: 'Feed',
    None: 'None',
};

const DEFAULT_THRESHOLDS = {
    Energy: new Percentage(85), // 85%
    Silver: new Percentage(100), // 100%
    Attack: new Percentage(10), // 10%
    Feed: new Percentage(0.05), // 0.05%
};

const DEFAULT_UNITS = {
    Artillery: [],
    Blitz: [],
    Railroads: [],
    Feeders: [],
    None: [],
};

/// @notice Holds the core logic for storing units, managing units, moving units, and setting constants
class DarkArtsManager {
    constructor(units = DEFAULT_UNITS) {
        this.thresholds = DEFAULT_THRESHOLDS; // attack, defense, feeding energy thresholds
        this.units = units; // object of our unit types, which each have arrays of planetIds
        this.name = 'Dark Arts'; // why not?
        this.whoIsAwesome = 'gubsheep'; // must have...
    }

    /// @notice Sets energy threshold levels
    setThreshold(key, val) {
        if (val <= 0) return fail('threshold check', [val]);
        this.thresholds[key] = val;
    }

    // ===== local storage unit management =====

    //// @notice Deletes a unit from local storage
    clearUnit(planetId, unitKey) {
        const loadedUnits = this.units;
        if (loadedUnits[unitKey].some((i) => i === planetId)) {
            loadedUnits[unitKey].filter((i) => i === planetId);
            this.update(loadedUnits);
        } else {
            console.log('Did not clear unit');
        }
    }

    /// @notice Adds a unit to local storage
    setUnit(planetId, unitKey) {
        const loadedUnits = this.units;
        if (
            loadedUnits[unitKey].some((i) => i !== planetId) ||
            loadedUnits[unitKey].length === 0
        ) {
            loadedUnits[unitKey].push(planetId);
            this.update(loadedUnits);
        } else {
            console.log('Did not set unit');
        }
    }

    /// @notice Updates the saved local storage units into this class's `units`.
    update(units) {
        this.saveUnits();
        this.units = units;
        this.storeUnits();
        return this.units;
    }

    /// @notice Set item in localStorage
    storeUnits() {
        localStorage.setItem(UNITS, JSON.stringify(this.units));
    }

    /// @notice Set a previous save in localStorage, so if the actual one is deleted this can be used as backup
    saveUnits() {
        localStorage.setItem(`${UNITS}-SAVE`, JSON.stringify(this.units));
    }

    /// @notice returns the saved localStorage item for units
    fetchSave() {
        return JSON.parse(localStorage.getItem(`${UNITS}-SAVE`));
    }

    /// @notice resets the `units` to the default units, and overrides the localStorage units with it
    wipeUnits() {
        this.saveUnits();
        this.units = DEFAULT_UNITS;
        this.storeUnits();
    }

    /// @notice Gets the units from localStorage and sets them in this class
    loadUnits() {
        const item = localStorage.getItem(UNITS);
        if (typeof item !== undefined) {
            this.units = JSON.parse(item);
        } else {
            return this.storeUnits();
        }
        return this.units;
    }

    /// @notice just prints the units in the console
    printUnits() {
        console.log(JSON.stringify(this.units));
        df.terminal.current.println(JSON.stringify(this.units));
    }

    // === Calculating Energy Potential ===

    /// @author https://github.com/darkforest-eth/plugins/tree/master/content/strategic/wage-war
    /// @notice fetches the effective power a planet can distributeSilver to a target
    /// @param src The source planet
    /// @param dst The destination planet
    /// @param maxEnergy The max energy to spend as a percentage of energyCap
    /// @param defenseThreshold The min energy percentage to store after the attack
    calcPotential(src, dst, maxEnergy, passCheck = false) {
        // safety check to make sure defenses are not too low and planet is known
        if (
            checkKnownPlanet(src) ||
            checkKnownPlanet(dst) ||
            (maxEnergy <= 10 && passCheck)
        )
            return 0;

        // if we are sending to our own planet
        if (dst.owner === df.getAccount()) {
            try {
                let offense = parseInt((src.energy * maxEnergy) / 100);
                let sent = Math.floor(
                    df.getEnergyArrivingForMove(
                        src.locationId,
                        dst.locationId,
                        distance(src, dst),
                        offense
                    )
                );
                let energyPercentage = new Percentage(sent / dst.energyCap);
                let thresholdCheck =
                    Math.floor(energyPercentage.raw) >=
                    this.thresholds[ThresholdTypes.Feed].raw;
                let potential = thresholdCheck ? offense : 0;
                return potential;
            } catch (e) {
                return 0;
            }
        } else {
            try {
                let offense = parseInt((src.energy * maxEnergy) / 100);
                let defense = dst.defense / DEFENSE;
                let sent = Math.floor(
                    df.getEnergyArrivingForMove(
                        src.locationId,
                        dst.locationId,
                        distance(src, dst),
                        offense
                    ) / defense
                );
                let threshold =
                    dst.owner === PIRATE
                        ? this.thresholds[ThresholdTypes.Feed].raw
                        : this.thresholds[ThresholdTypes.Attack].raw;

                let energyPercentage = new Percentage(sent / dst.energyCap);
                let thresholdCheck =
                    Math.floor(energyPercentage.raw) >= threshold;
                let potential = thresholdCheck ? offense : 0;
                return potential;
            } catch (e) {
                return 0;
            }
        }
    }

    /// @author https://github.com/darkforest-eth/plugins/tree/master/content/strategic/wage-war
    /// @notice Calculates the sum of all potential for a `src` planet
    calcAllPotential(src, guys) {
        let sum = 0;
        guys.forEach((guy) => {
            const potential = this.calcPotential(
                src,
                guy,
                this.thresholds[ThresholdTypes.Energy]
            );
            if (potential > 0) sum += potential;
        });
        return sum;
    }

    // ======= Distribute Resources ======

    /// @notice MANY to MANY
    /// @notice distributeSilver silver from planetType to a unitType
    /// @notice ex. distributeSilver silver from asteroids to spacetime rips
    distributeSilver(
        srcPlanetKey,
        srcUnitKey,
        dstPlanetKey,
        dstUnitKey,
        maxEnergy,
        maxSilver,
        minLevel
    ) {
        const { srcs, dsts } = this.fetchPlanets(
            srcPlanetKey,
            srcUnitKey,
            dstPlanetKey,
            dstUnitKey
        );

        let moves = 0;
        for (let src of srcs) {
            dsts = df
                .getPlanetsInRange(src.locationId, maxEnergy)
                .filter((p) => p.owner === df.getAccount())
                .filter((p) =>
                    dsts.some((dst) => p.locationId === dst.locationId)
                );
            // if we are going to a railroad, pick the closest one
            if (dstUnitKey === UnitKey.Railroads)
                dsts = this.railroadFilters(src, dsts);

            setTimeout(() => {
                moves += this.sendSilver(
                    src,
                    dsts,
                    maxEnergy,
                    maxSilver,
                    minLevel
                );
            }, 0);
        }

        return moves;
    }

    /// @Nnotice MANY to MANY
    distributeEnergy(
        srcPlanetKey,
        srcUnitKey,
        dstPlanetKey,
        dstUnitKey,
        maxEnergy,
        minLevel
    ) {
        const { srcs, dsts } = this.fetchPlanets(
            srcPlanetKey,
            srcUnitKey,
            dstPlanetKey,
            dstUnitKey
        );

        let moves = 0;
        for (let src of srcs) {
            dsts = df
                .getPlanetsInRange(src.locationId, maxEnergy)
                .filter((p) => p.owner === df.getAccount())
                .filter((p) =>
                    dsts.some((dst) => p.locationId === dst.locationId)
                );
            // if we are going to a railroad, pick the closest one
            if (dstUnitKey === UnitKey.Railroads)
                dsts = this.railroadFilters(src, dsts);

            setTimeout(() => {
                moves += this.sendEnergy(src, dsts, maxEnergy, minLevel);
            }, 0);
        }

        return moves;
    }

    // ===== Attacks =====

    /// @notice MANY to MANY
    /// @notice Captures unclaimed destination key planets using source key planets
    capturePlanets(
        srcPlanetKey,
        srcUnitKey,
        dstPlanetKey,
        dstUnitKey,
        maxEnergy,
        minLevel = 2
    ) {
        const { srcs, dsts } = this.fetchPlanets(
            srcPlanetKey,
            srcUnitKey,
            dstPlanetKey,
            dstUnitKey
        );

        let moves = 0;
        for (let src of srcs) {
            dsts = df
                .getPlanetsInRange(src.locationId, maxEnergy)
                .filter(
                    (p) =>
                        p.owner !== df.getAccount() &&
                        p.owner === PIRATE &&
                        p.planetLevel >= minLevel &&
                        dsts.some((dst) => p.locationId === dst.locationId)
                )
                .map((dst) => {
                    return [dst, distance(src, dst)];
                })
                .sort((a, b) => a[1] - b[1]); // sorts by distance so energy is spent on closer dsts first

            setTimeout(() => {
                moves += this.capture(src, dsts, maxEnergy);
            }, 0);
        }

        return moves;
    }

    // ======= ENERGY =======

    /// @notice MANY to ONE
    /// @notice Feed energy from MULTIPLE units of unit type to a target planet we own or an unclaimed planet with pirates
    feed(
        srcUnitType,
        dst,
        maxEnergy = this.thresholds[ThresholdTypes.Energy].points
    ) {
        if (dst.owner === df.getAccount() || dst.owner === PIRATE) {
            let moves = 0;
            let srcs = [];
            if (srcUnitType !== UnitType.None) {
                let units = this.units[getUnitKeyWithType(srcUnitType)];
                let planets = units.map((id) => df.getPlanetWithId(id));
                srcs = planets.filter((p) =>
                    df
                        .getPlanetsInRange(p.locationId, maxEnergy)
                        .some((p) => p.locationId === dst.locationId)
                );
            }

            setTimeout(() => {
                moves += this.receiveEnergy(srcs, dst, maxEnergy);
            }, 0);
            return moves;
        }
    }

    // ===== RESOURCE MOVEMENT =====

    move(srcId, dstId, energy, silver) {
        if (srcId === dstId)
            return fail('Cannot move to self', [srcId, dstId], 0);
        if (checkRateLimitedIn(dstId)) return 0;
        if (checkRateLimitedOut(srcId)) return 0;
        return move(srcId, dstId, energy, silver);
    }

    /// @author  https://github.com/darkforest-eth/plugins/blob/master/content/productivity/crawl-planets/plugin.js
    /// @notice  Capture planets from a SINGLE srcId to nearby planet or unit type
    /// @notice  ONE to MANY
    capture(
        src,
        dsts,
        maxEnergy = this.thresholds[ThresholdTypes.Energy].points
    ) {
        if (dsts.length === 0) return fail('no dsts', dsts, 0);
        // Rejected if has pending outbound moves
        const unconfirmed = df
            .getUnconfirmedMoves()
            .filter((move) => move.from === src.locationId);
        if (unconfirmed.length !== 0) return;

        let i = 0;
        let moves = 0;
        let energySpent = 0;

        const energyBudget = Math.floor((maxEnergy / 100) * planet.energy);

        while (energyBudget - energySpent > 0 && i < dsts.length) {
            const energyLeft = energyBudget - energySpent;

            // Remember its a tuple of candidates and their distance
            const dst = dsts[i++][0];

            // Rejected if has unconfirmed pending arrivals
            const unconfirmed = df
                .getUnconfirmedMoves()
                .filter((move) => move.to === dst.locationId);
            if (unconfirmed.length !== 0) continue;

            // Rejected if has pending arrivals
            const arrivals = getArrivalsForPlanet(dst.locationId);
            if (arrivals.length !== 0) continue;

            const energyArriving =
                dst.energyCap * 0.15 + dst.energy * (dst.defense / 100);
            // needs to be a whole number for the contract
            const energyToSend = Math.ceil(
                df.getEnergyNeededForMove(
                    src.locationId,
                    dst.locationId,
                    energyArriving
                )
            );

            if (energyLeft - energyToSend < 0) continue;

            this.move(src.locationId, dst.locationId, energyToSend, 0);
            energySpent += energyToSend;
            moves += 1;
        }

        return moves;
    }

    /// @notice Send energy from ONE to MANY
    sendEnergy(
        src,
        dsts,
        maxEnergy = this.thresholds[ThresholdTypes.Energy].points,
        minLevel = 1
    ) {
        if (dsts.length === 0) return fail('no dsts', dsts, 0);
        dsts = dsts
            .filter((dst) => dst.planetLevel >= minLevel)
            .map((dst) => [dst, distance(dst, src)])
            .sort((a, b) => a[1] - b[1]);

        let moves = 0;
        let i = 0;

        let energySpent = 0;
        const energyBudget = Math.floor((maxEnergy * src.energy) / 100);
        while (energyBudget - energySpent > 0 && i < dsts.length) {
            const energyLeft = energyBudget - energySpent;
            // Remember its a tuple of dsts and their distance
            const src = dsts[i++][0];
            const energyToSend = this.calcPotential(src, dst, maxEnergy);
            if (energyLeft - energyToSend < 0) continue;
            // Move from canidate to dst
            this.move(src.locationId, dst.locationId, energyToSend, 0);
            energySpent += energyToSend;
            moves += 1;
        }

        return moves;
    }

    /// @notice Send energy from MANY to ONE
    receiveEnergy(
        srcs,
        dst,
        maxEnergy = this.thresholds[ThresholdTypes.Energy].points
    ) {
        if (srcs.length === 0) return fail('no srcs', [srcs], 0);
        srcs = srcs
            .map((src) => [src, distance(src, dst)])
            .sort((a, b) => a[1] - b[1]);

        let moves = 0;
        let i = 0;
        while (i < srcs.length) {
            // Remember its a tuple of srcs and their distance
            const src = srcs[i++][0];
            const power = this.calcPotential(src, dst, maxEnergy);
            // Move from canidate to dst
            if (power <= 0) continue;
            this.move(src.locationId, dst.locationId, power, 0);
            moves += 1;
        }

        return moves;
    }

    /// @notice Send silve from ONE to MANY
    sendSilver(
        src,
        dsts,
        maxEnergy = this.thresholds[ThresholdTypes.Energy].points,
        maxSilver = this.thresholds[ThresholdTypes.Silver].points,
        minLevel = 1
    ) {
        if (dsts.length === 0) return fail('no dsts', dsts, 0);
        dsts = dsts
            .filter((dst) => dst.planetLevel >= minLevel)
            .map((dst) => [dst, distance(dst, src)])
            .sort((a, b) => a[1] - b[1]);

        let i = 0;
        let moves = 0;
        let silverSpent = 0;
        let energySpent = 0;

        const energyBudget = Math.floor((maxEnergy * src.energy) / 100);
        const silverBudget = Math.floor((maxSilver * src.silver) / 100);
        while (energyBudget - energySpent > 0 && i < dsts.length) {
            const silverLeft = silverBudget - silverSpent;
            const energyLeft = energyBudget - energySpent;
            // Remember its a tuple of dsts and their distance
            const dst = dsts[i++][0];
            const silverRequested = Math.ceil(dst.silverCap - dst.silver);

            const silverNeeded =
                silverRequested > silverLeft ? silverLeft : silverRequested;
            // Fail if we dont have more than 200 silver
            if (silverNeeded < 200) continue;
            // Energy required to send from dst to target
            const energyNeeded = Math.ceil(
                df.getEnergyNeededForMove(src.locationId, dst.locationId, 1)
            );

            // fail if we dont have enough energy
            if (energyLeft - energyNeeded < 0) continue;

            this.move(
                src.locationId,
                dst.locationId,
                energyNeeded,
                silverNeeded
            );
            energySpent += energyNeeded;
            silverSpent += silverNeeded;
            moves += 1;
        }

        return moves;
    }

    // ====== FETCHERS ======

    /// @notice Used in action functions to get an array of planets with a unit type
    getUnits(key) {
        if (Object.keys(UnitType).indexOf(key) !== -1)
            return this.units[key].map((unit) => df.getPlanetWithId(unit));
        if (Object.keys(PlanetType).indexOf(key) !== -1)
            return df
                .getMyPlanets()
                .filter((p) => p.planetType === PlanetType[key]);

        return [];
    }

    /// @returns the array of src and dst units requested from the keys
    fetchPlanets(srcPlanetKey, srcUnitKey, dstPlanetKey, dstUnitKey) {
        let srcUnits = this.getUnits(srcUnitKey);
        let srcPlanets = this.getUnits(srcPlanetKey);
        let dstUnits = this.getUnits(dstUnitKey);
        let dstPlanets = this.getUnits(dstPlanetKey);
        let srcs = [...srcUnits, ...srcPlanets];
        let dsts = [...dstUnits, ...dstPlanets];
        return { srcs, dsts };
    }

    // ====== PLANET UTILS =====

    /// @notice A filter when sending to railroads to choose the closest one
    railroadFilters(src, dsts) {
        return dsts
            .map((dst) => [dst, distance(dst, src)])
            .sort((a, b) => a[1] - b[1])[0][0];
    }
}

// ========== Utils for Army Manager ===========

/// @notice Checks a planet's outbound moves, returns `true` if there are 5+ outgoing moves
function checkRateLimitedOut(planetId) {
    const unconfirmed = df
        .getUnconfirmedMoves()
        .filter((move) => move.from === planetId);
    if (unconfirmed.length > 4)
        return fail('rate limited', [unconfirmed, planetId], true);
    return false;
}

/// @notice Checks a planet's inbound moves, returns `true` if there are 5+ incoming moves
function checkRateLimitedIn(planetId) {
    const unconfirmed = df
        .getUnconfirmedMoves()
        .filter((move) => move.to === planetId);
    const arrivals = getArrivalsForPlanet(planetId);
    if (unconfirmed.length + arrivals.length > 4)
        return fail('rate limited', [unconfirmed, arrival, planetId], true);
    return false;
}

// ============ APP ==============

/// @notice Has the selected class and options to get, set, remove selected planet
/// @dev    First row in UI
function Header({ unitType, planetType, onUnitChange, onPlanetChange }) {
    function onSet() {
        const key = getUnitKeyWithType(unitType) || 'None';
        const id = ui.getSelectedPlanet().locationId;
        window.darkArts.setUnit(id, key);
    }
    function onClear() {
        const key = 'None';
        const id = ui.getSelectedPlanet().locationId;
        window.darkArts.clearUnit(id, key);
    }

    function clearAll() {
        confirm('Are you sure you want to clear all units?');
        window.darkArts.wipeUnits();
    }

    return html`
    <${Box} id="header" flexDirection="column" style=${{ padding: '4px' }}>
        <${Box} id="header-row-1">
            <${Box} width="50%">
                <${H1} text=${'Manage Units'} />
            </${Box}>

            <${Box} width="50%">
                <${Button} onClick=${onSet}>Set Unit</${Button}>
                <${Spacer} />
                <${Button} onClick=${onClear}>Clear Unit</${Button}>
                <${Spacer} />
                <${Button} onClick=${clearAll}>Clear All</${Button}>
            </${Box}>
        </${Box}>

        <${Box} id="header-row-2"> 
            <${H1} text=${'1. Select Units'} />
        </${Box}>
        
        <${SelectTypes} 
            planetType=${planetType}
            unitType=${unitType}
            onPlanetChange=${onPlanetChange}
            onUnitChange=${onUnitChange}
        />
    </${Box}>`;
}

/// @notice Has stats for the selected unit
/// @dev    Second row of UI
function Stats({ unitType, planetType }) {
    const [all, setAll] = useState([]);

    const loadStats = useCallback(() => {
        const units = window.darkArts.loadUnits()[getUnitKeyWithType(unitType)];
        const planets = df
            .getMyPlanets()
            .filter((p) => p.planetType === planetType);
        const allUnits = [...units, ...planets];
        setAll(allUnits || []);
    }, [unitType]);

    const totalKings = useCallback(() => {
        let kings = 0;
        for (let planetId of all) {
            const planet = df.getPlanetWithId(planetId);
            if (planet.planetLevel === types.PlanetLevel.MAX) kings += 1;
        }

        return Math.floor(kings);
    }, [unitType, all]);

    const totalEnergy = useCallback(() => {
        let energies = 0;
        for (let planetId of all) {
            const planet = df.getPlanetWithId(planetId);
            energies += planet.energy;
        }

        return Math.floor(energies);
    }, [unitType, all]);

    const totalSilver = useCallback(() => {
        let silvers = 0;
        for (let planetId of all) {
            const planet = df.getPlanetWithId(planetId);
            silvers += planet.silver;
        }

        return Math.floor(silvers);
    }, [unitType, all]);

    useLayoutEffect(() => {
        loadStats();
    }, [unitType]);

    return html`
    <${Box} flexDirection="column" style=${{ padding: '4px' }}>

        <${H2} text=${'Stats for selected'} />

        <${Spacer} />

        <${Box}>
            <${Stat} label="Total Units" value=${all.length || 0} />
            <${Spacer} />
            <${Stat} label="Total Kings" value=${totalKings()} />
        </${Box}>

        <${Box}>
            <${Stat} label="Total Energy" value=${totalEnergy()} />
            <${Spacer} />
            <${Stat} label="Total Silver" value=${totalSilver()} />
        </${Box}>

    </${Box}>`;
}

/// @notice Actions to take with class or selected
/// @dev    Remaining rows of UI
function Actions({ unitType, planetType }) {
    const [energy, setEnergy] = useState('85');
    const [silver, setSilver] = useState('85');

    const [crawlTarget, setCrawlTarget] = useState('None');
    const [siegeTarget, setSiegeTarget] = useState('None');

    const [dstUnitType, setDstUnitType] = useState(UnitType.Artillery);
    const [dstPlanetType, setDstPlanetType] = useState(PlanetType.None);

    /// @notice Updates the destination unit type
    function onDstUnitChange(evt) {
        evt.preventDefault();
        setDstUnitType(UnitType[evt.target.value]);
    }

    /// @notice Updates the destination planet type
    function onDstPlanetChange(evt) {
        evt.preventDefault();
        setDstPlanetType(PlanetType[evt.target.value]);
    }

    /// @notice Updates the crawl target
    function onCrawlTargetChange(evt) {
        evt.preventDefault();
        setCrawlTarget(evt.target.value);
    }

    /// @notice Updates the siege target
    function onSiegeTargetChange(evt) {
        evt.preventDefault();
        const id = ui.getSelectedPlanet().locationId;
        setSiegeTarget(id);
    }

    const fetchKeys = useCallback(() => {
        let srcPlanetKey = getPlanetKeyWithType(planetType);
        let srcUnitKey = getUnitKeyWithType(unitType);
        let dstPlanetKey = getPlanetKeyWithType(dstPlanetType);
        let dstUnitKey = getUnitKeyWithType(dstUnitType);
        return { srcPlanetKey, srcUnitKey, dstPlanetKey, dstUnitKey };
    }, [planetType, unitType, dstPlanetType, dstUnitType]);

    const fetchResources = useCallback(() => {
        const maxEnergy = energy;
        const maxSilver = silver;
        return { maxEnergy, maxSilver };
    }, [energy, silver]);

    /// @notice Memoized callback for siege target id slice
    const getSiegeTarget = useCallback(() => {
        return siegeTarget.slice(4, 8);
    }, [siegeTarget, onSiegeTargetChange]);

    function doSilver() {
        const { srcPlanetKey, srcUnitKey, dstPlanetKey, dstUnitKey } =
            fetchKeys();
        const { maxEnergy, maxSilver } = fetchResources();
        const minLevel = 2;
        window.darkArts.distributeSilver(
            srcPlanetKey,
            srcUnitKey,
            dstPlanetKey,
            dstUnitKey,
            maxEnergy,
            maxSilver,
            minLevel
        );
    }

    function doEnergy() {
        const { srcPlanetKey, srcUnitKey, dstPlanetKey, dstUnitKey } =
            fetchKeys();
        const { maxEnergy } = fetchResources();
        const minLevel = 2;
        window.darkArts.distributeEnergy(
            srcPlanetKey,
            srcUnitKey,
            dstPlanetKey,
            dstUnitKey,
            maxEnergy,
            minLevel
        );
    }

    /// @notice Crawls to a target planet type with a source unit or planet type
    function doCrawl() {
        const { srcPlanetKey, srcUnitKey, dstPlanetKey } = fetchKeys();
        const dstUnitKey = getUnitKeyWithType(UnitType.None);
        const { maxEnergy } = fetchResources();
        const minLevel = 2;
        window.darkArts.capturePlanets(
            srcPlanetKey,
            srcUnitKey,
            dstPlanetKey,
            dstUnitKey,
            maxEnergy,
            minLevel
        );
    }

    function doSiege() {
        const { maxEnergy } = fetchResources();
        const srcUnitKey = getUnitKeyWithType(UnitType.Artillery); // only sending artillery units
        const targetPlanet = df.getPlanetWithId(siegeTarget); // siegeTarget is the planet id selected
        window.darkArts.feed(srcUnitKey, targetPlanet, maxEnergy); // sends max energy potential to target
    }

    return html`
    <${Box} flexDirection="column" style=${{ padding: '4px' }}>
            <${Box} background=${'#1111'}>
                <${H1} text=${'2. Send Resources'} />
            </${Box}>

                    
        <${Box} id="row-1">
            <${SelectResources} 
                energy=${energy}
                silver=${silver}
                setEnergy=${setEnergy}
                setSilver=${setSilver}
            />
        </${Box}>

        <${Spacer} />

        <${Box} background=${'#1111'}>
            <${H1} text=${'3. Choose Destination'} />
        </${Box}>

        <${Box}>
            <${SelectTypes} 
                planetType=${dstPlanetType}
                unitType=${dstUnitType}
                onPlanetChange=${onDstPlanetChange}
                onUnitChange=${onDstUnitChange}
            />
        </${Box}>

        <${Spacer} />

        <${Box} background=${'#1111'}>
            <${H1} text=${`4. Choose Action for ${getUnitKeyWithType(
        unitType
    )}`} />
        </${Box}>

        <${Box} id="row-2">
            <${Box} id="column-1-reqs" flexDirection="column">
                
                <${Box}>
                    <${Button} onClick=${doSilver}> Request Silver </${Button}>
                    <${Button} onClick=${doEnergy}> Request Energy </${Button}>
                </${Box}>

            </${Box}>

            <${Spacer} />

            <${Box} id="column-2-utils" flexDirection="column">
                    <${Box}>
                        <${H2} text="Crawl Target" />
                        <${Select}
                            options=${Object.keys(PlanetType)}
                            name="Crawl target"
                            value=${crawlTarget}
                            onChange=${onCrawlTargetChange}
                        />
                        <${Button} onClick=${doCrawl}> Crawl </${Button}>
                    </${Box}>

                    <${Spacer} />

                    <${Box}>
                        <${H2} text="Siege Target" />
                        <${Button} onClick=${onSiegeTargetChange}> Set </${Button}>
                        <${H2} text=${getSiegeTarget()} />
                        <${Button} onClick=${doSiege}> Siege </${Button}>
                    </${Box}>
                    
            </${Box}>

        </${Box}

    </${Box}>`;
}

/// @notice Puts all the above UI elements (rows) together
function App({}) {
    const [unitType, setUnitType] = useState(UnitType.Artillery);
    const [planetType, setPlanetType] = useState(PlanetType.None);

    function onUnitChange(evt) {
        evt.preventDefault();
        setUnitType(UnitType[evt.target.value]);
    }

    function onPlanetChange(evt) {
        evt.preventDefault();
        setPlanetType(PlanetType[evt.target.value]);
    }

    useLayoutEffect(() => {}, [unitType]);

    const style = { display: 'flex' };

    return html`
        <div id="root" style=${style}>
        <${Box} flexDirection=${'column'}>
            <${Header} unitType=${unitType} planetType=${planetType} onUnitChange=${onUnitChange} onPlanetChange=${onPlanetChange}/>
            
            <${Spacer} />

            <${Stats} unitType=${unitType} planetType=${planetType} />

            <${Spacer} />

            <${Actions} unitType=${unitType} planetType=${planetType}/>
        </${Box}>
        </div>
    `;
}

// ==== Utilities =====

function fail(reason, args, valueToReturn = null) {
    console.log(`Failed, due to check or otherwise: ${reason}`);
    console.log(
        `Failed with args:`,
        args.map((a) => a)
    );
    if (valueToReturn === null) {
        return;
    } else {
        return valueToReturn;
    }
}

function checkKnownPlanet(p) {
    return !p.location || !p.locationId || !p.location.coords;
}

// === From Distribute Silver plugin ===
/// https://github.com/darkforest-eth/plugins/tree/master/content/productivity/distributeSilver-silver

function getArrivalsForPlanet(planetId) {
    return df
        .getAllVoyages()
        .filter((arrival) => arrival.toPlanet === planetId)
        .filter((p) => p.arrivalTime > Date.now() / 1000);
}

//returns tuples of [planet,distance]
function distance(from, to) {
    let fromloc = from.location;
    let toloc = to.location;
    return Math.sqrt(
        (fromloc.coords.x - toloc.coords.x) ** 2 +
            (fromloc.coords.y - toloc.coords.y) ** 2
    );
}

export function sortCandidates(mapping, from) {
    return mapping
        .map((to) => [to, distance(from, to)])
        .sort((a, b) => a[1] - b[1]);
}

// ===== Local Storage =====

function getUnitKeyWithType(unitType) {
    return Object.keys(UnitKey)[unitType] || 'None'; // If unitType = 0, it gets first item in the UnitKeys
}

function getPlanetKeyWithType(planetType) {
    return Object.keys(PlanetType)[planetType] || 'None';
}

// ===== UI  Components =====

const FontSizes = {
    small: '12px',
    medium: '16px',
    large: '24px',
};

function SelectResources({ energy, silver, setEnergy, setSilver }) {
    function onChange(evt) {
        evt.preventDefault();
        return evt.target.value;
    }

    function onEnergyChange(evt) {
        setEnergy(onChange(evt));
    }

    function onSilverChange(evt) {
        setSilver(onChange(evt));
    }

    return html`
        <${Box}>
            <${Stepper} 
                label=${'Energy'}
                type=${'range'}
                min=${'0'}
                max=${'100'}
                step=${'5'}
                value=${energy}
                onChange=${onEnergyChange}
            />

            <${Stepper} 
                label=${'Silver'}
                type=${'range'}
                min=${'0'}
                max=${'100'}
                step=${'5'}
                value=${silver}
                onChange=${onSilverChange}
            />
        </${Box}
    `;
}

function SelectTypes({ planetType, unitType, onPlanetChange, onUnitChange }) {
    const planetOptions = Object.keys(PlanetType);
    const unitOptions = Object.keys(UnitType);

    return html`
        <${Box}>
            <${H2} text=${'Planet:'} />
            <${Select} 
                options=${planetOptions} 
                value=${getPlanetKeyWithType(planetType)}
                name=${'Planet'}
                onChange=${onPlanetChange}
            />

            <${Spacer} />

            <${H2} text=${'Unit:'} />
            <${Select} 
                options=${unitOptions} 
                value=${getUnitKeyWithType(unitType)}
                name=${'Unit'}
                onChange=${onUnitChange}
            />
        </${Box}>`;
}

function Stepper({ label, type, min, max, step, value, onChange }) {
    const style = {
        width: '80%',
        height: '24px',
    };

    return html`
    <${Box} flexDirection=${'column'}>
        <${Stat} label=${label} value=${value} unit=${'%'} />
        <${Spacer} />
        <input 
            style=${style}
            type=${type}
            min=${min}
            max=${max}
            step=${step}
            value=${value}
            onChange=${onChange}
        />
        </${Box}>
    `;
}

function Spacer({}) {
    const style = {
        height: '16px',
        minHeight: '16px',
        minWidth: '16px',
        width: '16px',
    };
    return html` <div style=${style} /> `;
}

function Stat({ label, value, unit }) {
    const left = {
        display: 'flex',
        justifyContent: 'left',
        fontSize: FontSizes.small,
    };

    const right = {
        display: 'flex',
        justifyContent: 'right',
        fontSize: FontSizes.small,
    };
    return html`
        <${Box} width="66%">
            <span style=${left}>${label}</span>
            <span style=${right}>${value} ${unit ? unit : ''}</span>
        </${Box}>
    `;
}

function H1({ text }) {
    const style = {
        fontSize: FontSizes.large,
    };
    return html`<h1 style=${style}>${text}</h1>`;
}

function H2({ text }) {
    const style = {
        fontSize: FontSizes.medium,
    };
    return html`<h2 style=${style}>${text}</h2>`;
}

function Option({ value, text }) {
    const style = {
        width: '100%',
        color: '#Ffff',
        padding: '4px',
        fontSize: FontSizes.medium,
    };
    return html`<option style=${style} value=${value}>${text}</option>`;
}

function Select({ options, name, value, onChange }) {
    const style = {
        color: '#ffff',
        background: 'rgb(8,8,8)',
        width: '100%',
    };

    return html` <div>
        <select style=${style} name=${name} value=${value} onChange=${onChange}>
            ${options.map((val) => {
                return html`<${Option} value=${val} text=${val || 'n/a'} />`;
            })}
        </select>
    </div>`;
}

function Box({ children, flexDirection, width, background }) {
    const style = {
        display: 'flex',
        justifyContent: 'space-between',
        whiteSpace: 'nowrap',
        flexDirection: flexDirection ? flexDirection : 'row',
        width: width ? width : '100%',
        background: background ? background : null,
    };
    return html`<div style=${style}>${children}</div>`;
}

function Button({ children, onClick }) {
    const style = {
        fontSize: FontSizes.medium,
        display: 'flex',
    };
    return html`
        <button style=${style} onClick=${onClick}>${children}</button>
    `;
}

// ===== Plugin =====

class Plugin {
    constructor() {
        window.darkArts = new DarkArtsManager();
        window.darkArts.loadUnits();
    }
    render(container) {
        container.style.minWidth = '600px';
        container.style.width = 'auto';

        this.container = container;
        render(html`<${App} />`, container);
        this.img = document.createElement('img');
        container.appendChild(this.img);
        this.img.style.display = 'none';
    }

    draw(ctx) {
        // <!!!as you can see I borrowed this from RAGE CAGE plugin!!!> loads
        this.units = window.darkArts.units;
        if (!this.units) return;

        // the viewport class provides helpful functions for
        // interacting with the currently-visible area of the
        // game
        const viewport = ui.getViewport();
        const planets = ui.getPlanetsInViewport();

        Object.keys(this.units).map((key) => {
            if (key === 'None') return;
            let planetIds = this.units[key];
            if (planetIds.length === 0) return;
            let myPlanetsInView = planets.filter(
                (p) => p.owner === df.getAccount()
            );
            let units = planetIds
                .map((id) => df.getPlanetWithId(id))
                .filter((p) =>
                    myPlanetsInView.some((v) => p.locationId === v.locationId)
                );
            const img = document.createElement('img');
            img.src = UnitImage[key];
            for (const p of units) {
                // use the Viewport class to determine the pixel
                // coordinates of the planet on the screen
                const pixelCenter = viewport.worldToCanvasCoords(
                    // @ts-ignore
                    p.location.coords
                );

                // how many pixels is the radius of the planet?
                const trueRadius = viewport.worldToCanvasDist(
                    ui.getRadiusOfPlanetLevel(p.planetLevel)
                );

                ctx.drawImage(
                    img,
                    10,
                    10,
                    125,
                    125,
                    pixelCenter.x - trueRadius,
                    pixelCenter.y - trueRadius,
                    trueRadius * 2,
                    trueRadius * 2
                );
            }
        });
    }

    destroy() {
        render(null, this.container, null);
    }
}

export default Plugin;
