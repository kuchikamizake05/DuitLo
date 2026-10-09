import {describe,it,expect} from 'vitest';
import {findInstitution,institutions} from './institutions';
import {existsSync} from 'node:fs';
describe('Indonesian financial institutions',()=>{
 it('matches aliases and account names without confusing blu with BCA',()=>{
  expect(findInstitution('BCA Utama')?.id).toBe('bca');expect(findInstitution('blu by BCA Digital')?.id).toBe('blu-bca');expect(findInstitution('GoPay Wallet')?.kind).toBe('ewallet');expect(findInstitution('OVO Cash')?.id).toBe('ovo');expect(findInstitution('Neobank')?.id).toBe('bnc');expect(findInstitution('Tunai')).toBeUndefined();
 });
 it('provides a local logo for every unique choice',()=>{
  expect(institutions.length).toBe(36);expect(new Set(institutions.map(item=>item.id)).size).toBe(36);for(const item of institutions)expect(existsSync(`public/institutions/${item.id}.svg`)).toBe(true);
 });
});
