import {describe,it,expect,vi,afterEach} from 'vitest';
import {readAccountDisplay,saveAccountDisplay} from './account-display';
afterEach(()=>vi.unstubAllGlobals());
describe('account display preferences',()=>{
 it('stores settings per user and account',()=>{const rows=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>rows.set(key,value)});expect(saveAccountDisplay('one','bank',{cardColor:'royal-blue',includeInNetWorth:false})).toBe(true);expect(readAccountDisplay('one','bank')).toEqual({cardColor:'royal-blue',includeInNetWorth:false});expect(readAccountDisplay('two','bank')).toEqual({cardColor:'',includeInNetWorth:true});});
 it('does not turn a completed financial save into a failure when local storage is blocked',()=>{vi.stubGlobal('localStorage',{setItem:()=>{throw new Error('Storage blocked');},getItem:()=>{throw new Error('Storage blocked');}});expect(saveAccountDisplay('one','bank',{cardColor:'green',includeInNetWorth:true})).toBe(false);expect(readAccountDisplay('one','bank')).toEqual({cardColor:'',includeInNetWorth:true});});
});
