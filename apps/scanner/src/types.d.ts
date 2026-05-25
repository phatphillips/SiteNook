declare module 'nspell'
declare module 'text-readability'
declare module 'dictionary-en' {
  function dictionary(callback: (err: Error | null, result: { aff: Buffer, dic: Buffer }) => void): void
  export = dictionary
}
