import Image from "next/image";

export default function BrandLogo() {
  return <Image className="brand-logo" src="/friends-logo.png" alt="Human and AI chat buddies" width={64} height={64} sizes="64px" />;
}
