
import { toast as toastPrimitive } from "sonner";
import * as React from "react";

type ToasterToast = any;

const TOAST_LIMIT = 20;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterActionElement = React.ReactElement<unknown> | null;

type ToasterProps = React.ComponentPropsWithoutRef<typeof toastPrimitive>;

type ToastData = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToasterActionElement;
  toastProps?: ToasterProps;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToastData;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToastData>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToastData["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToastData["id"];
    };

interface State {
  toasts: ToastData[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }

    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

// Enhanced toast function that adapts to sonner's API
function toast(options: string | React.ReactNode | Omit<ToastData, "id"> | {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToasterActionElement;
  id?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  // Handle simple string toast
  if (typeof options === 'string' || React.isValidElement(options)) {
    return toastPrimitive(options);
  }
  
  const { id = genId(), ...rest } = options as any;
  
  // Use sonner's API
  return toastPrimitive(rest.title, {
    description: rest.description,
    id,
    ...rest
  });
}

// Add other toast variants to match sonner API
toast.success = toastPrimitive.success;
toast.error = toastPrimitive.error;
toast.warning = toastPrimitive.warning;
toast.info = toastPrimitive.info;
toast.loading = toastPrimitive.loading;
toast.custom = toastPrimitive;

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

// Export both the hook and the standalone function
export { toast, useToast };
