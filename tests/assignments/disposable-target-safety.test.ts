import { describe, expect, it, vi } from 'vitest';
import { parseDisposableCampaignTarget, verifyDisposableCampaignTarget } from './helpers/disposableCampaignTarget';

const identity = 'matrix-fault-0123456789';
function manifest() {
  return { identity,network:identity,ingress:`${identity}-ingress`,url:'http://127.0.0.1:54481',
    containers: { 'supabase_db_dev-history':`${identity}-db`,'supabase_auth_dev-history':`${identity}-auth`,
      'supabase_rest_dev-history':`${identity}-rest`,'supabase_kong_dev-history':`${identity}-gateway`,
      'supabase_edge_runtime_dev-history':`${identity}-edge`,'history-delivery-capture':`${identity}-capture`,
      'supabase_inbucket_dev-history':`${identity}-mail` },
    volumes:{'supabase_db_dev-history':`${identity}-db`,'history_edge_code_dev-history':`${identity}-code`,
      'history_edge_src_dev-history':`${identity}-src`,'history_edge_cache_dev-history':`${identity}-cache`,
      'history_edge_captures_dev-history':`${identity}-captures`} };
}
type Container = { Config:{Labels:Record<string,string>};State:{Running:boolean};NetworkSettings:{Networks:Record<string,object>};
  HostConfig:{PortBindings:Record<string,Array<{HostIp:string;HostPort:string}>>}; Mounts:Array<{Type:string;Name:string;RW:boolean}> };
function reader(change?: (name: string, container: Container) => void) {
  return vi.fn((...args: string[]) => {
    const labels = {'local.matrix-fault':identity};
    if (args[0]==='network') return JSON.stringify([{Internal:true,Labels:labels}]);
    if (args[0]==='volume') return JSON.stringify([{Labels:labels,Driver:'local',Options:null}]);
    const name=args.at(-1)!; const gateway=name.endsWith('-gateway');
    const container:Container={Config:{Labels:labels},State:{Running:true},
      NetworkSettings:{Networks:gateway?{[identity]:{},[`${identity}-ingress`]:{}}:{[identity]:{}}},
      HostConfig:{PortBindings:gateway?{'8000/tcp':[{HostIp:'127.0.0.1',HostPort:'54481'}]}:{}},
      Mounts:[{Type:'volume',Name:`${identity}-db`,RW:true}]};
    change?.(name,container); return JSON.stringify([container]);
  });
}
describe('disposable target admission',()=>{
  it.each(['https://project.supabase.co','http://localhost:54481','http://127.0.0.1:54481@evil.invalid','http://127.0.0.1:54441'])(
    'rejects non-disposable gateway %s',url=>{expect(()=>parseDisposableCampaignTarget({...manifest(),url})).toThrow();});
  it('rejects historical container reuse',()=>{
    const value=manifest();value.containers['supabase_db_dev-history']='supabase_db_dev-history';
    expect(()=>parseDisposableCampaignTarget(value)).toThrow('clone identity');
  });
  it('rejects historical volume reuse',()=>{
    const value=manifest();value.volumes['supabase_db_dev-history']='supabase_db_dev-history';
    expect(()=>parseDisposableCampaignTarget(value)).toThrow('clone identity');
  });
  it('freezes the target and nested resource lists',()=>{
    const target=parseDisposableCampaignTarget(manifest());
    expect(Object.isFrozen(target)).toBe(true);expect(Object.isFrozen(target.containers)).toBe(true);expect(Object.isFrozen(target.volumes)).toBe(true);
  });
  it('accepts an owned isolated clone using read-only Docker inspection',()=>{
    const docker=reader();verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),docker);
    expect(docker.mock.calls.every(([operation])=>['network','volume','inspect'].includes(operation))).toBe(true);
  });
  it('rejects outbound routing',()=>{
    const docker=reader();docker.mockImplementationOnce(()=>JSON.stringify([{Internal:false,Labels:{'local.matrix-fault':identity}}]));
    expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),docker)).toThrow('owned and internal');
  });
  it('rejects an unowned volume despite an owned network',()=>{
    const normal=reader();const docker=(...args:string[])=>args[0]==='volume'?JSON.stringify([{Labels:{}}]):normal(...args);
    expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),docker)).toThrow('volume ownership');
  });
  it.each([
    {Driver:'local',Options:{type:'none',o:'bind',device:'/historical-storage'}},
    {Driver:'remote-plugin',Options:null},
  ])('rejects labelled volume backed by $Driver with options $Options',backing=>{
    const normal=reader();const docker=(...args:string[])=>args[0]==='volume'
      ?JSON.stringify([{Labels:{'local.matrix-fault':identity},...backing}]):normal(...args);
    expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),docker)).toThrow('plain local storage');
  });
  it('rejects unowned and stopped services',()=>{
    for(const change of [(container:Container)=>{container.Config.Labels={};},(container:Container)=>{container.State.Running=false;}]) {
      expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),reader((_name,container)=>change(container)))).toThrow('owned and running');
    }
  });
  it('rejects extra runtime networking',()=>{
    expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),reader((name,container)=>{
      if(name.endsWith('-edge'))container.NetworkSettings.Networks.bridge={};
    }))).toThrow('unexpected network');
  });
  it('rejects published database ports',()=>{
    expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),reader((name,container)=>{
      if(name.endsWith('-db'))container.HostConfig.PortBindings={'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'54482'}]};
    }))).toThrow('cannot publish ports');
  });
  it('rejects a non-loopback gateway binding',()=>{
    expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),reader((name,container)=>{
      if(name.endsWith('-gateway'))container.HostConfig.PortBindings['8000/tcp'][0].HostIp='0.0.0.0';
    }))).toThrow('binding must match loopback');
  });
  it('rejects mounts of historical volumes',()=>{
    expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),reader((_name,container)=>{
      container.Mounts[0].Name='supabase_db_dev-history';
    }))).toThrow('unowned volume');
  });
  it('rejects writable host bind mounts',()=>{
    expect(()=>verifyDisposableCampaignTarget(parseDisposableCampaignTarget(manifest()),reader((_name,container)=>{
      container.Mounts[0].Type='bind';
    }))).toThrow('host bind mount');
  });
});
