import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

const FestivalManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();

  if (!jobId) {
    return <div>Job ID is required</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Festival Management</CardTitle>
          <Button 
            onClick={() => navigate(`/festival-management/${jobId}/artists`)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Manage Artists
          </Button>
        </CardHeader>
        <CardContent>
          {/* Additional festival management content can go here */}
        </CardContent>
      </Card>
    </div>
  );
};

export default FestivalManagement;