import { useState, useEffect } from 'react';

/**
 * Atrasa um valor: só muda depois de `delay` ms sem alterações (ex: pesquisar só quando se pára de escrever)
 * @param value - O valor a atrasar
 * @param delay - Atraso em milissegundos (por omissão: 500 ms)
 * @returns O valor atrasado
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
