import { useQuery } from '@tanstack/react-query';
import type { ComboboxGroup, ComboboxItem } from '@/components/ui/combobox';
import { queryKeys } from '@/lib/react-query';
import { dataLayerClient } from '@/services/dataLayerClient';

export interface DeptUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface EligibleTaskUser extends DeptUser {
  department: string | null;
}

export interface EligibleTaskUserOptions {
  flat: DeptUser[];
  groups: ComboboxGroup[];
  items: ComboboxItem[];
}

export function groupEligibleTaskUsers(
  users: EligibleTaskUser[],
  userDepartment: string | null,
): EligibleTaskUserOptions {
  const mine: ComboboxGroup = { heading: 'Tu departamento', items: [] };
  const others: ComboboxGroup = { heading: 'Otros departamentos', items: [] };
  const flat: DeptUser[] = [];
  const items: ComboboxItem[] = [];

  for (const user of users) {
    const label = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.id;
    const item = { value: user.id, label };
    flat.push(user);
    items.push(item);
    if (userDepartment && user.department === userDepartment) {
      mine.items.push(item);
    } else {
      others.items.push(item);
    }
  }

  const groups: ComboboxGroup[] = [];
  if (mine.items.length > 0) groups.push(mine);
  if (others.items.length > 0) groups.push(others);
  return { flat, groups, items };
}

export function useAllEligibleTaskUsers(userDepartment: string | null) {
  return useQuery<EligibleTaskUserOptions>({
    queryKey: queryKeys.scope('all-eligible-users', userDepartment),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('profiles')
        .select('id, first_name, last_name, department')
        .order('first_name');
      if (error) throw error;

      return groupEligibleTaskUsers((data || []) as EligibleTaskUser[], userDepartment);
    },
  });
}
