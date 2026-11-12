/** The guide character: a sheet of paper with one corner folded down, and two eyes. */
export function Guide({ size = 28 }: { size?: number }) {
  return (
    <svg class="guide" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path class="guide-sheet" d="M7 3.5h12.5L26 10v18.5H7z" />
      <path class="guide-fold" d="M19.5 3.5V10H26z" />
      <circle class="guide-eye" cx="13" cy="17.5" r="1.25" />
      <circle class="guide-eye" cx="19.5" cy="17.5" r="1.25" />
    </svg>
  );
}
