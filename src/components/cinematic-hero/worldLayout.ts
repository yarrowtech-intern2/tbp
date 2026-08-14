// Shared spatial constants so every scene component agrees on where things sit
// in the low-poly world without duplicating magic numbers per file.

export const TRAVELER_BASE_POS: [number, number, number] = [0, 0, 0.4];
export const BUS_BASE_POS: [number, number, number] = [1.1, 0, -2.4];
export const BUS_DOOR_POS: [number, number, number] = [0.3, 0, -1.9];

export const ROAD_SEGMENT_LENGTH = 6;
export const ROAD_SEGMENT_COUNT_HIGH = 10;
export const ROAD_SEGMENT_COUNT_LOW = 6;
// World units of apparent travel per unit of proxies.bus.travel (0..~1.12) —
// tunes how "far" the journey feels without ever building a huge world.
export const ROAD_TRAVEL_SCALE = 220;

export const VEGETATION_COUNT_HIGH = 36;
export const VEGETATION_COUNT_LOW = 16;

export const CLOUD_PUFF_COUNT_HIGH = 26;
export const CLOUD_PUFF_COUNT_LOW = 14;

// Color stops used to lerp the sky/ground/vegetation from a green inland
// landscape toward a bright tropical/coastal palette across proxies.environment.mix.
export const PALETTE = {
  skyInland: '#bcd6ea',
  skyCoastal: '#d9f0f4',
  fogInland: '#c7dcee',
  fogCoastal: '#e8f6f6',
  groundInland: '#4f7a4a',
  groundCoastal: '#e4d3a3',
  vegetationInland: '#3f6b3a',
  vegetationCoastal: '#4f9b6a',
  sand: '#f0dfb4',
  ocean: '#2f7f9e',
  oceanFoam: '#eef8f8',
  busBody: '#f4f4f0',
  busAccent: '#c0472a',
  travelerSkin: '#caa07a',
  travelerShirt: '#3a6fa8',
  travelerPants: '#2a2a33',
};
