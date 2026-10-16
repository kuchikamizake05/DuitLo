export type ReservedGoalAsset={id:string;currency:string;current_amount:number;is_active:boolean};
type WalletAsset={id:string;kind:string;currency:string;current_balance:number;reporting_balance_idr:number|null;is_active:boolean;includeInNetWorth?:boolean};

/** Goal deposits reserve assets outside wallet balances; they are not spending. */
export function summarizeTrackedAssets(accounts:readonly WalletAsset[],goals:readonly ReservedGoalAsset[],rates:ReadonlyMap<string,number>=new Map()){
 let walletFunds=0,reservedGoals=0,walletComplete=true,goalsComplete=true;
 const missing=new Set<string>(),reservedByCurrency:Record<string,number>={};
 for(const account of accounts){
  if(!account.is_active||account.kind==="liability"||account.includeInNetWorth===false)continue;
  const value=account.currency==="IDR"?Number(account.current_balance):account.reporting_balance_idr===null?NaN:Number(account.reporting_balance_idr);
  if(!Number.isFinite(value)){walletComplete=false;missing.add(account.currency);continue;}
  walletFunds+=value;
 }
 for(const goal of goals){
  const amount=Number(goal.current_amount);
  if(!Number.isFinite(amount)||amount<0){goalsComplete=false;missing.add(goal.currency);continue;}
  if(amount===0)continue;
  reservedByCurrency[goal.currency]=(reservedByCurrency[goal.currency]??0)+amount;
  const rate=goal.currency==="IDR"?1:rates.get(goal.currency);
  if(rate===undefined||!Number.isFinite(rate)||rate<=0){goalsComplete=false;missing.add(goal.currency);continue;}
  reservedGoals+=amount*rate;
 }
 const walletFundsIdr=walletComplete&&Number.isFinite(walletFunds)?walletFunds:null;
 const reservedGoalsIdr=goalsComplete&&Number.isFinite(reservedGoals)?reservedGoals:null;
 const combined=walletFunds+reservedGoals;
 return {
  walletFundsIdr,
  reservedGoalsIdr,
  totalTrackedIdr:walletFundsIdr!==null&&reservedGoalsIdr!==null&&Number.isFinite(combined)?combined:null,
  reservedByCurrency,
  missingCurrencies:[...missing].sort(),
 };
}
