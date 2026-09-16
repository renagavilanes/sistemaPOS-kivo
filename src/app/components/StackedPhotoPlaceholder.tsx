import { cn } from './ui/utils';

/** Placeholder de producto: dos fotos superpuestas (vacío o mix de combo). */
export function StackedPhotoPlaceholder({
  className,
  frontSrc,
  backSrc,
}: {
  className?: string;
  frontSrc?: string;
  backSrc?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-gray-100',
        className,
      )}
      aria-hidden
    >
      <PolaroidFrame className="-translate-x-[22%] translate-y-[8%] -rotate-12" src={backSrc} />
      <PolaroidFrame className="translate-x-[20%] -translate-y-[6%] rotate-[14deg]" src={frontSrc} showIcon />
    </div>
  );
}

function PolaroidFrame({
  className,
  src,
  showIcon,
}: {
  className?: string;
  src?: string;
  showIcon?: boolean;
}) {
  return (
    <div
      className={cn(
        'absolute aspect-square w-[48%] overflow-hidden rounded-[14%] border border-gray-200 bg-white',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover object-center" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-50">
          {showIcon ? <PhotoGlyph /> : <PhotoGlyph muted />}
        </div>
      )}
    </div>
  );
}

function PhotoGlyph({ muted }: { muted?: boolean }) {
  return (
    <svg
      className={cn('h-[42%] w-[42%]', muted ? 'text-gray-200' : 'text-gray-300')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L21.75 21M12.75 9.75h.008v.008H12.75V9.75z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25V6.75z"
      />
    </svg>
  );
}
