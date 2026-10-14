param([switch]$Execute,[switch]$Push)
$ErrorActionPreference='Stop'
function Invoke-FinTrackCommits {
 param([switch]$Apply,[switch]$Publish)
 $repoRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
 Push-Location $repoRoot
 $oldAuthorDate=$env:GIT_AUTHOR_DATE
 $oldCommitterDate=$env:GIT_COMMITTER_DATE
 try {
  $plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'commit-plan-oct-2026.json') -Raw | ConvertFrom-Json
  if((git diff --cached --name-only)){throw 'Existing staged changes must be handled first.'}
  if((git branch --show-current) -ne $plan.branch){throw 'Branch differs from the recorded commit plan.'}
  $changedFiles=@(git ls-files --modified --others --exclude-standard)
  foreach($group in $plan.commits){
   $pending=@($group.files | Where-Object { $changedFiles -contains $_ })
   if(!$pending.Count){continue}
   Write-Output "$($group.date) | $($group.message) | $($pending.Count) files"
   if(!$Apply){continue}
   git add -- $pending
   if($LASTEXITCODE){throw 'Staging failed.'}
   $commitStamp=if($group.date -is [datetime]){$group.date.ToString("yyyy-MM-ddTHH:mm:sszzz")}else{[string]$group.date}
   $env:GIT_AUTHOR_DATE=$commitStamp
   $env:GIT_COMMITTER_DATE=$commitStamp
   git commit -m $group.message
   if($LASTEXITCODE){throw 'Commit failed.'}
  }
  if($Publish){
   if(!$Apply){throw 'Push requires Execute.'}
   if((git status --porcelain)){throw 'Uncommitted files remain; inspect before pushing.'}
   git push origin $plan.branch
   if($LASTEXITCODE){throw 'Push failed.'}
  }
 } finally {
  $env:GIT_AUTHOR_DATE=$oldAuthorDate
  $env:GIT_COMMITTER_DATE=$oldCommitterDate
  Pop-Location
 }
}
Invoke-FinTrackCommits -Apply:$Execute -Publish:$Push
