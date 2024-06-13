// Max exclusive, I think
export const randInt = (max: number) => Math.floor(Math.random() * max);
export const randIntBetween = (min: number, max: number) =>
    randInt(max - min) + min;

export const wait = (millis: number) =>
    new Promise<null>((resolve) => setTimeout(() => resolve(null), millis));
