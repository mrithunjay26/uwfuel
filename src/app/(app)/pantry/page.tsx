import { redirect } from "next/navigation";

export default function PantryRedirect() {
  redirect("/menu?tab=pantry");
}
