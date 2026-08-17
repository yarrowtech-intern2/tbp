const CLOUDS = [
  {
    className: 'rtw-cloud rtw-cloud-background',
    src: '/cinematic-hero/cloud-background.webp',
  },
  {
    className: 'rtw-cloud rtw-cloud-middle rtw-cloud-left',
    src: '/cinematic-hero/cloud-middle.webp',
  },
  {
    className: 'rtw-cloud rtw-cloud-foreground rtw-cloud-right',
    src: '/cinematic-hero/cloud-foreground.webp',
  },
] as const;

export const CloudLayers = () => (
  <div className="rtw-cloud-stage" aria-hidden="true">
    {CLOUDS.map((cloud) => (
      <img
        key={cloud.className}
        className={cloud.className}
        src={cloud.src}
        alt=""
        loading="eager"
        decoding="async"
      />
    ))}
  </div>
);
