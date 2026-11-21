// Colours from docs/reference/visual-reference.md (sections 2 and 5).
export const P = {
  rockLight: '#A8A195',
  rockWarm: '#BDB4A2',
  rockMid: '#86837B',
  rockShade: '#5B5A58',
  rockStreak: '#3B3A38',
  rockCave: '#2E2D2C',
  rockOchre: '#B08A5A',
  lichen: ['#8E8F4E', '#B9853A'],
  moss: '#6F7B45',
  roofTile: ['#C2623A', '#A9553A', '#D98A5B'],
  wall: ['#F2EEE4', '#E8DFC8'],
  stationOchre: '#E0B24A',
  monasteryStone: '#B7A88C',
  monasteryPlaster: '#DDD2BB',
  timber: '#5A3F2B',
  stStephenDrum: '#C9736A',
  townHallBlue: '#2F5FA8',
  museumCharcoal: '#4A4A4C',
  // Not named in the sheet: flat concrete roofs take the paver grey, lead domes the haze blue-grey.
  flatRoof: '#9A968F',
  leadDome: '#5E7A86',
  asphalt: '#5E5F61',
  pavers: '#9A968F',
  residential: '#9A968F',
  dirt: '#B49A72',
  grass: '#7FA046',
  dryGrass: '#C9B878',
  farmland: '#8DB255',
  ploughed: '#9B7B55',
  orchard: '#6FA03A',
  forest: '#3F6B2F',
  planeCanopy: '#6FA03A',
  cypress: '#26402A',
  scrub: '#5C7038',
  gravel: '#D4CEC0',
  water: '#5F9AA8',
  haze: '#5E7A86',
  sky: '#8FBDE6',
  // Town surfaces: the sheet names none of these, so each takes the nearest listed tone.
  townGround: '#DDD2BB',  // pale concrete/earth: monastery plaster
  pavement: '#A8A195',    // pavement pavers: rock light
  carPark: '#86837B',     // dusty car-park asphalt: rock mid
  schoolYard: '#BDB4A2',  // yard concrete: rock warm (section 2)
  court: '#5E7A86',       // painted hard court: distant mountain haze
  pitchGrass: '#8DB255',  // field green
  runTrack: '#A9553A',    // running-track terracotta: aged roof tile
  playground: '#C9736A',  // rubber safety surface: St Stephen drums
  cemetery: '#D4CEC0',    // cemetery gravel: river gravel
  pool: '#8FBDE6',        // pool blue: sky
  garden: '#6FA03A',      // garden green: fresh plane canopy
  fountain: '#43BFC0',    // turquoise-painted fountain basin (from photos of the town-hall square)
  foam: '#EAF6F5',        // falling water
  // Squares and paved streets use `pavers`, unpaved roads `dirt`; markings and tombs take wall white.
  // Skirt bands, top to bottom: dirt, ploughed earth, rock shade.
  strata: ['#B49A72', '#9B7B55', '#5B5A58'],
};
