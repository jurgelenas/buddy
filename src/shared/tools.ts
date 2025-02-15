export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const times = (num: number): number[] =>
  new Array<number>(num).fill(1).map((_, i) => i);

export const hexString = (num: number): string => {
  const byteCount = Math.ceil(16 / 8);

  // eslint-disable-next-line no-bitwise
  return `0x${(num >>> 0)
    .toString(16)
    .toUpperCase()
    .padStart(byteCount * 2, "0")}`;
};

export const arrayFromAsync = async <T>(
  iterator: AsyncIterableIterator<T>
): Promise<T[]> => {
  const data: T[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for await (const value of iterator) {
    data.push(value);
  }

  return data;
};

export const findAsync = async <T>(
  iterator: AsyncIterableIterator<T>,
  findFunc: (item: T) => boolean
): Promise<T | undefined> => {
  // eslint-disable-next-line no-restricted-syntax
  for await (const value of iterator) {
    if (findFunc(value)) {
      return value;
    }
  }

  return undefined;
};
