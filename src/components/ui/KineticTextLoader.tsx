import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface KineticTextLoaderProps extends HTMLAttributes<HTMLDivElement> {
  text?: string;
}

/**
 * VengeanceUI "kinetic text loader", adapted to the LinuxDocs editorial tokens.
 *
 * Renders `text` (default "Loading") as a looping kinetic word: the leading "L"
 * bounces, the 5th letter stretches (rendered dotless so the orbiting emerald
 * dot reads as its accent), and the dot orbits above the word.
 *
 * Colors are theme tokens (var(--terminal-green), var(--text-heading),
 * var(--font-sans)) so it matches the main webpage UI wherever it's mounted.
 */
export const KineticTextLoader = ({
  className,
  text = 'Loading',
  ...props
}: KineticTextLoaderProps) => {
  const letters = text.split('');

  return (
    <div
      className={cn('relative flex items-center justify-center font-medium', className)}
      {...props}
    >
      {/* Responsive scale — mirrors the original's md/lg steps */}
      <div className="relative scale-75 md:scale-90 lg:scale-100">
        {/* Orbiting dot — hovers over the stretched letter */}
        <div
          aria-hidden="true"
          className="ktl-dot absolute left-[85px] top-[40px] z-10 h-[6px] w-[6px] rounded-full"
        />

        <p
          aria-label={text}
          className="relative m-0 whitespace-nowrap text-[3.75rem] leading-none text-[var(--text-heading)]"
        >
          {letters.map((char, index) => {
            if (index === 0 && char.toUpperCase() === 'L') {
              return (
                <span
                  key={index}
                  className="ktl-bounce relative inline-block tracking-[8px] text-[var(--terminal-green)]"
                >
                  {char}
                </span>
              );
            }

            if (index === 4 && char.toLowerCase() === 'i') {
              return (
                <span
                  key={index}
                  className="ktl-stretch relative inline-block tracking-[8px] text-[var(--terminal-green)]"
                >
                  {char === 'i' ? '\u0131' : char}
                </span>
              );
            }

            return (
              <span key={index} className="relative inline-block tracking-[8px]">
                {char}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
};

export default KineticTextLoader;