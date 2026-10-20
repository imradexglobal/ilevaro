import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function OwnerPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-slate-900">Owner Profile</h2>
      <p className="mt-2 text-slate-500">
        Owner profile management. (Feature coming in later phase.)
      </p>
      <Button onClick={() => navigate("/dashboard")} className="mt-4">
        Back to Dashboard
      </Button>
    </div>
  );
}