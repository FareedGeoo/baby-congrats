const iconPaths = {
  star: (
    <path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.8Z" />
  ),
  cloud: (
    <path d="M7.2 18.5h10.2a4.1 4.1 0 0 0 .4-8.2A6.1 6.1 0 0 0 6 9.5a4.5 4.5 0 0 0 1.2 9Z" />
  ),
  heart: (
    <path d="M20.2 8.8c0 4.1-8.2 10-8.2 10s-8.2-5.9-8.2-10a4.4 4.4 0 0 1 8.2-2.2 4.4 4.4 0 0 1 8.2 2.2Z" />
  ),
  bow: (
    <>
      <path d="m12 12-7.5-5a3.1 3.1 0 0 0-1.2 4.8l7.2 3.3L12 12Z" />
      <path d="m12 12 7.5-5a3.1 3.1 0 0 1 1.2 4.8l-7.2 3.3L12 12Z" />
      <circle cx="12" cy="12" r="1.8" />
      <path d="m10.5 14-1 6 2.5-2 2.5 2-1-6" />
    </>
  ),
  crown: (
    <path d="m3 8 4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5L3 8Z" />
  ),
};

export function ScrapbookIcon({ name, size = 28, className = '' }) {
  const path = iconPaths[name];
  if (!path) {
    throw new RangeError(`Unknown scrapbook icon: ${name}`);
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

export function PaperCard({ children, className = '', ...props }) {
  return (
    <article className={`paper-card ${className}`} {...props}>
      {children}
    </article>
  );
}

export function PhotoCorners({ children, className = '' }) {
  return (
    <div className={`photo-corners ${className}`}>
      {children}
      <span className="photo-corner photo-corner--start-start" aria-hidden="true" />
      <span className="photo-corner photo-corner--start-end" aria-hidden="true" />
      <span className="photo-corner photo-corner--end-start" aria-hidden="true" />
      <span className="photo-corner photo-corner--end-end" aria-hidden="true" />
    </div>
  );
}

export function PolaroidFrame({
  src,
  alt = '',
  caption,
  children,
  tilt = '-1.5deg',
  onClick,
  buttonLabel,
  onError,
  loading = 'lazy',
}) {
  return (
    <figure className="polaroid-frame" style={{ '--polaroid-tilt': tilt }}>
      <PhotoCorners className="polaroid-image">
        {src ? (
          onClick ? (
            <button
              type="button"
              className="polaroid-photo-button"
              aria-label={buttonLabel || alt}
              onClick={onClick}
            >
              <img src={src} alt={alt} width="800" height="600" loading={loading} onError={onError} />
            </button>
          ) : (
            <img src={src} alt={alt} width="800" height="600" loading={loading} onError={onError} />
          )
        ) : (
          <div className="polaroid-placeholder" aria-hidden="true">
            {children || <ScrapbookIcon name="cloud" size={42} />}
          </div>
        )}
      </PhotoCorners>
      {caption && <figcaption className="polaroid-caption">{caption}</figcaption>}
    </figure>
  );
}

export function WashiTape({ className = '' }) {
  return <span className={`scrapbook-tape ${className}`} aria-hidden="true" />;
}

export function PaperClip({ className = '' }) {
  return <span className={`scrapbook-clip ${className}`} aria-hidden="true" />;
}

export function ScrapbookLabel({ children, className = '' }) {
  return <span className={`scrapbook-label ${className}`}>{children}</span>;
}

export function ScrapbookSticker({ children, icon = 'star', className = '' }) {
  return (
    <span className={`scrapbook-sticker ${className}`}>
      {icon && <ScrapbookIcon name={icon} size={16} />}
      <span>{children}</span>
    </span>
  );
}
