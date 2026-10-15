"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** UPI deep link with the amount filled in — works in PhonePe, GPay, Paytm, BHIM. */
export function upiLink(upiId: string, payee: string, amount: number, note: string) {
  const q = new URLSearchParams({ pa: upiId, pn: payee, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

export default function UpiQr({ link, size = 220 }: { link: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(link, { width: size * 2, margin: 1, errorCorrectionLevel: "M" }).then(setSrc, () => setSrc(""));
  }, [link, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="UPI QR code" width={size} height={size} className="rounded-xl bg-white p-2" />
  ) : (
    <span className="block animate-pulse rounded-xl bg-surface-2" style={{ width: size, height: size }} />
  );
}
