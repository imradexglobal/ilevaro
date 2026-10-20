import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function CommissionsPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-slate-900">Commissions</h2>
      <p className="mt-2 text-slate-500">
        Management commissions, letting commissions, and renewal fees.
      </p>
      <Button onClick={() => navigate("/dashboard")} className="mt-4">
        Back to Dashboard
      </Button>
    </div>
  );
}