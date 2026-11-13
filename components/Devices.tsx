// Скриншоттарға арналған нақты құрылғы рамкалары: ноутбук және телефон
export function Laptop({ src, alt, eager = false }: { src: string; alt: string; eager?: boolean }) {
  return (
    <figure className="mx-auto w-full" aria-label={alt}>
      <div className="relative rounded-t-[14px] border border-black/40 bg-[#161614] p-[1.6%] pb-[2.2%] shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)]">
        <span className="absolute left-1/2 top-[0.55%] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-[#2c2c29]" />
        <div className="overflow-hidden rounded-[3px] bg-ink">
          <img src={src} alt={alt} width={1920} height={1200} className="block aspect-[16/10] w-full object-cover object-top" loading={eager ? "eager" : "lazy"} decoding="async" />
        </div>
      </div>
      <div className="relative mx-[-4%] h-[10px] rounded-b-[14px] bg-gradient-to-b from-[#cfcdc6] to-[#9f9d96] shadow-[0_14px_26px_-12px_rgba(0,0,0,.5)] sm:h-[14px]">
        <span className="absolute left-1/2 top-0 h-[40%] w-[14%] -translate-x-1/2 rounded-b-[8px] bg-[#8d8b84]" />
      </div>
    </figure>
  );
}

export function Phone({ src, alt, eager = false, className = "" }: { src: string; alt: string; eager?: boolean; className?: string }) {
  return (
    <figure className={`relative mx-auto aspect-[390/844] w-full max-w-[300px] rounded-[44px] bg-[#111110] p-[3.2%] shadow-[0_30px_60px_-25px_rgba(0,0,0,.6)] ring-1 ring-black/40 ${className}`} aria-label={alt}>
      <span className="absolute left-1/2 top-[2.6%] z-10 h-[3.2%] w-[30%] -translate-x-1/2 rounded-full bg-[#111110]" />
      <div className="h-full w-full overflow-hidden rounded-[36px] bg-salt">
        <img src={src} alt={alt} width={780} height={1688} className="block h-full w-full object-cover object-top" loading={eager ? "eager" : "lazy"} decoding="async" />
      </div>
    </figure>
  );
}

/** Скриншот түріне қарай: телефон немесе ноутбук */
export function Device({ src, phone, alt, eager }: { src: string; phone?: boolean; alt: string; eager?: boolean }) {
  return phone ? <Phone src={src} alt={alt} eager={eager} /> : <Laptop src={src} alt={alt} eager={eager} />;
}
