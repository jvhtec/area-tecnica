
// Function to expose the reestablishSubscriptions method
public reestablishSubscriptions() {
  console.log('Manually reestablishing subscriptions');
  this.setupPingChannel();
  
  const now = Date.now();
  this.lastReconnectAttempt = now;
  this.connectionStatus = 'connecting';
  
  // Copy all existing subscriptions to pending
  this.subscriptions.forEach((subscription, key) => {
    this.pendingSubscriptions.set(key, subscription.options);
  });
  
  // Clean up existing subscriptions
  this.unsubscribeAll(false);
  
  // Resubscribe to all tables
  this.pendingSubscriptions.forEach((options, key) => {
    this.subscribeToTable(options.table, options.queryKey, options.filter, options.priority);
    this.pendingSubscriptions.delete(key);
  });
  
  // Perform a full query invalidation to refresh data
  this.queryClient.invalidateQueries();
  
  this.connectionStatus = 'connected';
  console.log('Supabase subscriptions manually reestablished');
  
  return true;
}
