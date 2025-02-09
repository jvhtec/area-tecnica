import React, { useState } from 'react';
import { createLaborPO, addResourceLineItem, updateLineItemDates, getProjectDetails, getProjectHeader } from './apiService';
import { PlusCircle, Clock, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const LaborPOForm: React.FC = () => {
  const { toast } = useToast();
  
  const departmentOptions = [
    { id: 'cdd5e372-d124-11e1-bba1-00e08175e43e', name: 'Sound Department' },
    { id: 'a89d124d-7a95-4384-943e-49f5c0f46b23', name: 'Video Department' },
    { id: 'd5af7892-d124-11e1-bba1-00e08175e43e', name: 'Lighting Department' },
  ];

  const jobRoleOptions = [
    { id: '2915a190-c515-11ea-a087-2a0a4490a7fb', name: 'Responsable de Sonido' },
    { id: 'f1224528-9038-486b-b1b8-a8085cb24651', name: 'Tecnico Especialista' },
  ];

  const availableWorkers = [
    { id: '18c0acc0-cc37-11eb-8106-f23c925290b3', name: 'Alvaro González Miranda' },
    { id: '842e1628-faa1-4f6b-a05e-8f44f00d2d26', name: 'Andrés Dellarrosa' },
  ];

  const [projectData, setProjectData] = useState({
    projectNumber: '',
    jobName: '',
    venue: '',
    plannedStartDate: '',
    plannedEndDate: '',
  });

  const [retrievedIds, setRetrievedIds] = useState({
    parentElementId: '',
    personResponsibleId: '',
    locationId: '',
  });

  const [workers, setWorkers] = useState([{
    id: 1,
    name: '',
    departmentId: '',
    resourceId: '',
    shifts: [{
      id: 1,
      date: '',
      startTime: '09:00',
      endTime: '17:00'
    }]
  }]);

  const handleProjectSearch = async () => {
    if (!projectData.projectNumber) {
      toast({
        title: "Error",
        description: "Please enter a project number",
        variant: "destructive"
      });
      return;
    }

    try {
      const searchText = `${projectData.projectNumber}HR`;
      const projectDetails = await getProjectDetails(searchText);

      if (projectDetails.length === 0) {
        toast({
          title: "Error",
          description: "No matching project folder found",
          variant: "destructive"
        });
        return;
      }

      const projectId = projectDetails[0].id;
      const projectHeader = await getProjectHeader(projectId);

      setProjectData(prev => ({
        ...prev,
        jobName: projectHeader.documentName,
        venue: projectHeader.venueId,
        plannedStartDate: projectHeader.plannedStartDate?.split('T')[0] || '',
        plannedEndDate: projectHeader.plannedEndDate?.split('T')[0] || '',
      }));

      setRetrievedIds({
        parentElementId: projectId,
        personResponsibleId: projectHeader.personResponsibleId?.id || '',
        locationId: projectHeader.locationId,
      });

      toast({
        title: "Success",
        description: "Project details retrieved successfully",
      });
    } catch (error) {
      console.error('Error fetching project details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch project details. Please try again.",
        variant: "destructive"
      });
    }
  };

  const addWorker = () => {
    setWorkers((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: '',
        departmentId: '',
        resourceId: '',
        shifts: [{ id: 1, date: '', startTime: '09:00', endTime: '17:00' }],
      },
    ]);
  };

  const removeWorker = (id: number) => {
    setWorkers((prev) => prev.filter((worker) => worker.id !== id));
  };

  const addShift = (workerId: number) => {
    setWorkers((prev) =>
      prev.map((worker) =>
        worker.id === workerId
          ? {
              ...worker,
              shifts: [
                ...worker.shifts,
                { id: worker.shifts.length + 1, date: '', startTime: '09:00', endTime: '17:00' },
              ],
            }
          : worker
      )
    );
  };

  const removeShift = (workerId: number, shiftId: number) => {
    setWorkers((prev) =>
      prev.map((worker) =>
        worker.id === workerId
          ? {
              ...worker,
              shifts: worker.shifts.filter((shift) => shift.id !== shiftId),
            }
          : worker
      )
    );
  };

  const updateWorker = (id: number, name: string) => {
    setWorkers((prev) =>
      prev.map((worker) => (worker.id === id ? { ...worker, name } : worker))
    );
  };

  const updateShift = (workerId: number, shiftId: number, date: string) => {
    setWorkers((prev) =>
      prev.map((worker) =>
        worker.id === workerId
          ? {
              ...worker,
              shifts: worker.shifts.map((shift) =>
                shift.id === shiftId ? { ...shift, date } : shift
              ),
            }
          : worker
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { parentElementId, personResponsibleId, locationId } = retrievedIds;

      if (!parentElementId || !personResponsibleId || !locationId) {
        toast({
          title: "Error",
          description: "Please perform a project search first",
          variant: "destructive"
        });
        return;
      }

      const laborPO = await createLaborPO({
        name: projectData.jobName,
        plannedStartDate: projectData.plannedStartDate,
        plannedEndDate: projectData.plannedEndDate,
        personResponsibleId,
        locationId,
        vendorId: workers[0]?.name || '',
        parentElementId,
      });

      for (const worker of workers) {
        const lineItem = await addResourceLineItem({
          documentId: laborPO.id,
          resourceId: worker.resourceId,
          resourceParentId: parentElementId,
          managedResourceLineItemType: 'service-offering',
          quantity: worker.shifts.length,
        });

        for (const shift of worker.shifts) {
          await updateLineItemDates({
            documentId: laborPO.id,
            lineItemId: lineItem.addedResourceLineIds[0],
            alternatePickupDate: shift.date,
            alternateReturnDate: shift.date,
          });
        }
      }

      toast({
        title: "Success",
        description: "Labor PO created successfully",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to create Labor PO",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Labor PO Creation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium mb-1">Project Number</label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={projectData.projectNumber}
                  onChange={(e) =>
                    setProjectData((prev) => ({ ...prev, projectNumber: e.target.value }))
                  }
                  className="w-full p-2 border rounded"
                />
                <button
                  type="button"
                  onClick={handleProjectSearch}
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Workers</h3>
              <button
                type="button"
                onClick={addWorker}
                className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
              >
                <PlusCircle className="w-5 h-5" />
                Add Worker
              </button>

              {workers.map((worker, index) => (
                <Card key={index}>
                  <CardContent>
                    <div className="flex flex-col space-y-2">
                      <select
                        value={worker.name}
                        onChange={(e) =>
                          updateWorker(worker.id, e.target.value)
                        }
                      >
                        <option value="">Select Worker</option>
                        {availableWorkers.map((availableWorker) => (
                          <option key={availableWorker.id} value={availableWorker.id}>
                            {availableWorker.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeWorker(worker.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      {worker.shifts.map((shift) => (
                        <div key={shift.id} className="flex items-center space-x-2">
                          <input
                            type="date"
                            value={shift.date}
                            onChange={(e) => updateShift(worker.id, shift.id, e.target.value)}
                            className="border rounded"
                          />
                          <button
                            type="button"
                            onClick={() => removeShift(worker.id, shift.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addShift(worker.id)}
                        className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
                      >
                        <PlusCircle className="w-5 h-5" />
                        Add Shift
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <button type="submit" className="w-full p-3 bg-blue-500 text-white rounded">
              Submit
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LaborPOForm;
