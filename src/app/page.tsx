import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  const userType = (session.user as any)?.userType;
  if (userType === "party") redirect("/mis-casos");
  redirect("/dashboard");
}
