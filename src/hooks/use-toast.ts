
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

// Enhanced toast function that adapts to sonner's API and handles variant conversion
function toast(options: string | React.ReactNode | Omit<ToastData, "id"> | {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToasterActionElement;
  id?: string;
  variant?: "default" | "destructive" | "success" | "warning" | "info";
  onOpenChange?: (open: boolean) => void;
}) {
  // Handle simple string toast
  if (typeof options === 'string' || React.isValidElement(options)) {
    return toastPrimitive(options);
  }
  
  const { id = genId(), variant, ...rest } = options as any;
  
  // Map variant to the appropriate sonner method
  if (variant) {
    switch (variant) {
      case "destructive":
        return toastPrimitive.error(rest.title, {
          description: rest.description,
          id,
          ...rest
        });
      case "success":
        return toastPrimitive.success(rest.title, {
          description: rest.description,
          id,
          ...rest
        });
      case "warning":
        return toastPrimitive.warning(rest.title, {
          description: rest.description,
          id,
          ...rest
        });
      case "info":
        return toastPrimitive.info(rest.title, {
          description: rest.description,
          id,
          ...rest
        });
      default:
        // Default case for "default" variant or no variant
        return toastPrimitive(rest.title, {
          description: rest.description,
          id,
          ...rest
        });
    }
  }

  // Use sonner's API for default case
  return toastPrimitive(rest.title, {
    description: rest.description,
    id,
    ...rest
  });
}

// Add API-compatible methods for backward compatibility
toast.success = (title: string, options?: any) => {
  const { description, ...rest } = options || {};
  return toastPrimitive.success(title, { description, ...rest });
};

toast.error = (title: string, options?: any) => {
  const { description, ...rest } = options || {};
  return toastPrimitive.error(title, { description, ...rest });
};

toast.warning = (title: string, options?: any) => {
  const { description, ...rest } = options || {};
  return toastPrimitive.warning(title, { description, ...rest });
};

toast.info = (title: string, options?: any) => {
  const { description, ...rest } = options || {};
  return toastPrimitive.info(title, { description, ...rest });
};

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
