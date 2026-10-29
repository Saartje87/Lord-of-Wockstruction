import { notFound } from "next/navigation";
import { Prototype3dLoader } from "./loader";

// PROTOTYPE, throwaway: the 3D renderer spike. Dev builds and Vercel
// preview deploys only, so it can be tried on a phone; never the live site.
export default function Prototype3dPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview"
  )
    notFound();
  return <Prototype3dLoader />;
}
