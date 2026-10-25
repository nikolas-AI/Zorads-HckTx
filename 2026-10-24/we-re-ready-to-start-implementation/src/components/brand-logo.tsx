import Image from "next/image";

export default function BrandLogo() {
  return <Image className="brand-logo" src="/friends-logo.png" alt="AImigos logo" width={76} height={76} sizes="76px" />;
}
