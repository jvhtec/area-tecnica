import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ExcelTool = () => {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Excel Tool</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Use this tool to manage Excel files.
          </p>
          <div className="space-y-4">
            <Button variant="outline">
              Upload Excel File
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExcelTool;