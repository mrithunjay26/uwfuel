import { redirect } from "next/navigation";

// The dorm pantry now lives inside the Dining tab.
export default function PantryRedirect() {
  redirect("/menu?tab=pantry");
}
