export const SPEEDS = Object.freeze({normal:{label:'Normal',value:3.2},medium:{label:'Mittel',value:6.4},fast:{label:'Schnell',value:9.6}});
export const speedLevel = value => Object.hasOwn(SPEEDS,value) ? value : 'normal';
export function approachSpeed(current, level, dt) {return current+(SPEEDS[speedLevel(level)].value-current)*(1-Math.exp(-Math.max(0,dt)*9));}
