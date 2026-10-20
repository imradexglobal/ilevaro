import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function DepositsPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-slate-900">Deposits</h2>
      <p className="mt-2 text-slate-500">
        Security deposit tracking and refund management.
      </p>
      <Button onClick={() => navigate("/dashboard")} className="mt-4">
        Back to Dashboard
      </Button>
    </div>
  );
}