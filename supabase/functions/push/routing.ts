import { createClient } from "./deps.ts";
import type { PushNotificationRoute } from "./types.ts";

export async function getPushNotificationRoutes(
  client: ReturnType<typeof createClient>,
  eventCode: string,
): Promise<PushNotificationRoute[]> {
  if (!eventCode) return [];
  try {
    const { data, error } = await client
      .from('push_notification_routes')
      .select('event_code, recipient_type, target_id, include_natural_recipients')
      .eq('event_code', eventCode)
      .returns<PushNotificationRoute[]>();
    if (error) {
      console.error('push routing fetch error', { eventCode, error });
      return [];
    }
    return data ?? [];
  } catch (error) {
    console.error('push routing fetch error', { eventCode, error });
    return [];
  }
}

type RoutingOverrideOptions = {
  routes: PushNotificationRoute[];
  recipients: Set<string>;
  naturalRecipients: Set<string>;
  management: Set<string>;
  getDepartmentRecipients: (department: string) => Promise<string[]>;
  participants?: Set<string>;
};

export async function applyRoutingOverrides({
  routes,
  recipients,
  naturalRecipients,
  management,
  getDepartmentRecipients,
  participants,
}: RoutingOverrideOptions): Promise<void> {
  if (!routes.length) return;

  let includeNatural = false;
  for (const route of routes) {
    if (route.include_natural_recipients === true || route.recipient_type === 'natural') {
      includeNatural = true;
      break;
    }
  }

  if (!includeNatural) {
    for (const id of naturalRecipients) {
      recipients.delete(id);
    }
  }

  const departmentCache = new Map<string, string[]>();
  const add = (id: string | null | undefined) => {
    if (id) {
      recipients.add(id);
    }
  };

  for (const route of routes) {
    switch (route.recipient_type) {
      case 'broadcast':
        for (const id of management) add(id);
        break;
      case 'management_user':
        if (route.target_id) {
          add(route.target_id);
        } else {
          for (const id of management) add(id);
        }
        break;
      case 'department':
        if (route.target_id) {
          const key = route.target_id;
          let deptRecipients = departmentCache.get(key);
          if (!deptRecipients) {
            const fetched = await getDepartmentRecipients(route.target_id);
            deptRecipients = Array.isArray(fetched) ? fetched : [];
            departmentCache.set(key, deptRecipients);
          }
          for (const id of deptRecipients) add(id);
        }
        break;
      case 'natural':
        // no-op; handled by includeNatural flag
        break;
      case 'assigned_technicians':
        if (participants && participants.size) {
          for (const id of participants) add(id);
        }
        break;
    }
  }
}

async function runRoutingSelfTests() {
  try {
    const recipients = new Set<string>(['actor', 'natural-recipient']);
    const naturalRecipients = new Set<string>(['natural-recipient']);
    const management = new Set<string>(['manager-a']);
    const routes: PushNotificationRoute[] = [
      {
        event_code: 'unit.test',
        recipient_type: 'department',
        target_id: 'sound',
        include_natural_recipients: false,
      },
      {
        event_code: 'unit.test',
        recipient_type: 'assigned_technicians',
        target_id: null,
        include_natural_recipients: false,
      },
    ];
    const departmentMap = new Map<string, string[]>([['sound', ['dept-manager']]]);
    const participants = new Set<string>(['tech-a', 'tech-b']);
    await applyRoutingOverrides({
      routes,
      recipients,
      naturalRecipients,
      management,
      participants,
      getDepartmentRecipients: async (department) => departmentMap.get(department) ?? [],
    });
    console.assert(
      !recipients.has('natural-recipient'),
      'Natural recipients should be removed when include_natural_recipients is false',
    );
    console.assert(
      recipients.has('dept-manager'),
      'Department routes should include department-specific management users',
    );
    console.assert(
      recipients.has('tech-a') && recipients.has('tech-b'),
      'Assigned technicians route should include job participants',
    );
  } catch (error) {
    console.error('push routing self-test failed', error);
  }
}

void runRoutingSelfTests();

