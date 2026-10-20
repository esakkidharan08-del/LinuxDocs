/* eslint-disable react/only-export-components -- component and its shared helper live together */
/**
 * SocialFlipButton — adapted from the VengeanceUI registry item
 * `social-flip-button` (https://ui.shadcn.com/registry social-flip-button.json),
 * restyled to the LinuxDocs editorial theme tokens (dark + light aware via
 * `var(--…)`), and reduced to the three requested channels: LinkedIn, GitHub,
 * Fiverr.
 *
 * Behaviour is identical to the original: hover the group to flip every tile
 * (letter → brand icon) with a spring, animated border lines sweep the
 * container, and each tile shows a label tooltip.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FaDiscord, FaEnvelope, FaGithub, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiFiverr } from 'react-icons/si';
import { cn } from '../../lib/utils';

export interface SocialItem {
  letter: string;
  icon: ReactNode;
  label: string;
  href?: string;
}

interface SocialFlipButtonProps {
  items?: SocialItem[];
  className?: string;
  itemClassName?: string;
}

// Single source of truth for the contact channels.
// The seven tiles spell C·O·N·T·A·C·T — flip each to reveal its channel.
export const SOCIAL_ITEMS: SocialItem[] = [
  { letter: 'C', icon: <FaLinkedinIn />, label: 'LinkedIn', href: 'https://www.linkedin.com/in/esakki-dharan-b24525391/' },
  { letter: 'O', icon: <FaGithub />, label: 'GitHub', href: 'https://github.com/esakkidharan08-del' },
  { letter: 'N', icon: <SiFiverr />, label: 'Fiverr', href: 'https://www.fiverr.com/esakki_dharan/buying?source=avatar_menu_profile' },
  { letter: 'T', icon: <FaEnvelope />, label: 'Email', href: 'mailto:esakkidharan08@gmail.com' },
  { letter: 'A', icon: <FaXTwitter />, label: 'X (Twitter)', href: 'https://x.com/DharanEsak80589' },
  { letter: 'C', icon: <FaInstagram />, label: 'Instagram', href: 'https://www.instagram.com/dharan._.2629/' },
  { letter: 'T', icon: <FaDiscord />, label: 'Discord', href: 'https://discord.com/users/1553622090026848271' },
];

const SocialFlipNode = ({
  item,
  index,
  isHovered,
  setTooltipIndex,
  tooltipIndex,
  itemClassName,
}: {
  item: SocialItem;
  index: number;
  isHovered: boolean;
  setTooltipIndex: (val: number | null) => void;
  tooltipIndex: number | null;
  itemClassName?: string;
}) => {
  const Wrapper = item.href ? 'a' : 'div';
  const isMailto = item.href ? item.href.startsWith('mailto:') : false;
  const wrapperProps = item.href
    ? isMailto
      ? { href: item.href }
      : { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      aria-label={item.label}
      title={item.label}
      className={cn('relative h-11 w-11 cursor-pointer', itemClassName)}
      style={{ perspective: '1000px' }}
      onMouseEnter={() => setTooltipIndex(index)}
      onMouseLeave={() => setTooltipIndex(null)}
    >
      <AnimatePresence>
        {isHovered && tooltipIndex === index && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8, x: '-50%' }}
            animate={{ opacity: 1, y: -50, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 10, scale: 0.8, x: '-50%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute left-1/2 z-50 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--bg-surface-elevated)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--text-heading)]"
          >
            {item.label}
            <div className="absolute -bottom-[4.5px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[var(--border)] bg-[var(--bg-surface-elevated)]" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="relative h-full w-full"
        initial={false}
        animate={{ rotateY: isHovered ? 180 : 0 }}
        transition={{
          duration: 0.8,
          type: 'spring',
          stiffness: 120,
          damping: 15,
          delay: index * 0.08,
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front — letter */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-surface-hover)] font-mono text-base font-semibold text-[var(--text-heading)] shadow-[0_2px_10px_-4px_var(--shadow-color)]"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {item.letter}
        </div>

        {/* Back — brand icon */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-md bg-[var(--terminal-green)] text-base text-[var(--bg)]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {item.icon}
        </div>
      </motion.div>
    </Wrapper>
  );
};

const SocialFlipButton = ({
  items = SOCIAL_ITEMS,
  className,
  itemClassName,
}: SocialFlipButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  return (
    <div className={cn('flex items-center justify-center gap-4', className)}>
      <div
        className="group relative flex items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-elevated)] p-3 shadow-[0_18px_40px_-30px_var(--shadow-color)]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setTooltipIndex(null);
        }}
      >
        {/* Clipped animated border lines */}
        <div className="pointer-events-none absolute -inset-px overflow-hidden rounded-lg">
          <motion.div
            className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--terminal-green)] to-transparent opacity-40"
            animate={reducedMotion ? { x: 0 } : { x: ['-100%', '100%'] }}
            transition={
              reducedMotion
                ? { duration: 0.001 }
                : { duration: 2.5, repeat: Infinity, ease: 'linear' }
            }
          />
          <motion.div
            className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--terminal-green)] to-transparent opacity-40"
            animate={reducedMotion ? { x: 0 } : { x: ['100%', '-100%'] }}
            transition={
              reducedMotion
                ? { duration: 0.001 }
                : { duration: 2.5, repeat: Infinity, ease: 'linear' }
            }
          />
        </div>

        {items.map((item, index) => (
          <SocialFlipNode
            key={item.label}
            item={item}
            index={index}
            isHovered={isHovered}
            setTooltipIndex={setTooltipIndex}
            tooltipIndex={tooltipIndex}
            itemClassName={itemClassName}
          />
        ))}
      </div>
    </div>
  );
};

export default SocialFlipButton;