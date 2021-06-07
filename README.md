# df-dark-arts
Unit manager plugin for dark forest v0.6

Setup your units, and control them at a click of a button.

Features:
- Set specific planets as a "unit" role, which gives it a new image overlay!
- Send energy between planet types and/or unit types easily
- Request unit types to be fed with energy or silver
- Crawl a planet type using all your units of the selected unit type
- Use 6 artillery units to siege a target planet (does not work for enemies right now)


There is a lot missing, probably bugs, and the images are bad! This is v0.1 of this plugin.

# The Dark Arts of War Plugin

by Alexander

In Dark Forest, the fog of war menaces fresh players who scramble to defend against attacks which  have their source hidden. This aspect of the game makes war strategies especially effective, and the best tool to leverage it is something to control many planets with a single button. This is the Dark Arts plugin. 

# Units

The plugin enables  you to control a *unit* type with the click of a button. Units are arbitrary, they can mean or be anything. The plugin has several units which are not programmed as anything, they are basically labels. They can be extended to be programmatically defined.

These are the units I wanted to label and control easily

## Railroads

- High base range, often has double range.
- Upgraded to max range rank + defense
- Used for energy and silver transport
- Should be only 1 per sector

These Railroads are hubs for planets to send energy and silver to. Nearby planets will prioritize the closest Railroad, and will only send resources to one of them. This makes it so Railroads become full of energy and silver quickly, so they can be transported to the target location, like another Railroad, quasar, or space rip.

## Artillery

- High base range, preferably double
- Upgraded to max range rank + speed
- Used for final blows to enemy planets, or sieging
- Can be many in an area
- On the edges of borders OR nearby a Railroad
- L4 and above

Artillery units are very similar to Railroads, and they should only be labeled Artillery when a Railroad is nearby. Since there should only be 1 Railroad per sector, the remaining range units can be labelled artillery.

## Blitz

- High base speed
- L3 and under
- Ranked up range + speed
- Preferably corrupted and have low base defense

Blitz units are our tiny units which are utilized to crawl territory, distract enemies, and quickly respond to energy needs from our own planets. The lower level planets (≤3) are often unutilized when warring. There will be some great strategies which I plan to share in my next posts on how to best utilize these units, as they are critical to the winning strategies. 

## Feeders

- High base energy
- L3 and above
- Ranked up defense + range
- Preferably have double energy or energy growth
- Nearby Artillery, Railroads, or L5+ planets

Self-explaining unit type. These are designated planets that are better off feeding a neighboring large planet (for example, a higher level planet with double range), than upgrading offensive stats. They should be used to recharge planets in between attacks, overcharge them during siege, or limit energy growth if captured by an enemy.

# Features

### Planet and Unit control

- Source Planet Types can be selected (Planet, Asteroid, Quasar, etc.)
- Source Unit Types can be selected (Blitz, Artillery, Railroad, etc.)
- Destination Planet and Unit types can be selected

This features gives you large control over cohorts of units and planet types. For example, send energy from your Battery units to your Artillery units. Or, send silver from Asteroids to your Railroads. This is the main utility of the plugin: control clusters of units rather than individuals.

### Unit Crawl

- Combined with the crawler plugin, select any planet type or unit type to crawl nearby planets.

Uses the crawler logic with the unit controller to allow crawler from units to be much easier— better than global crawl.

### Planet and Unit Distribute Silver & Energy

- Transmit silver between planet or unit types.

Uses the functionality in the distribute-silver plugin, allowing asteroids to move its silver directly to nearby space rips. Extends this functionality to allow asteroids to distribute silver to a nearby unit type, or other planet type. Using the quick upgrade plugin would allow you to take advantage of this easy distribution mechanism. These combined plugins basically turn into an "upgrade fleet" plugin. 

### Siege

- Repeatedly siege target using artillery units

This starts a siege on a target planet with up to 6 artillery units. This should serve as the final blow to those large planets you want to take, controlled by enemies or just pirates!

## Summary

Overall there's still a lot more I want to do with this plugin. There is also the artistic side to explore— customize the units with better images (I have some rough emoji pics overlapping the units you set), customize unit move path colors, add enemy labels and units (which can then be targeted), etc. I thought I'd release this early to get some ideas as I build this up! Just wait until I start throwing some smart contract stuff into here... imagine buying a cluster of unit's attack power!