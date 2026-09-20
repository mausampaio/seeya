# V2-T17 item 1(b)/(c) measurement tooling: sums working-set memory and cumulative CPU time
# across a process AND every descendant it has spawned -- an Electron app is several processes
# (main, gpu, renderer, utility), and a single process's own number would understate both. Walks
# Win32_Process's own ParentProcessId links from -RootProcessId, the same way Windows Task
# Manager's "process tree" grouping does, rather than filtering by process NAME -- a name match
# would also catch an unrelated already-installed copy of the app running on the same machine
# (found while writing this task, see docs/DESEMPENHO.md's own note on this).
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File process-tree-stats.ps1 -RootProcessId <pid>
# Prints one line of JSON: { processCount, workingSetBytes, cpuSeconds }.

param(
    [Parameter(Mandatory = $true)]
    [int]$RootProcessId
)

$ErrorActionPreference = 'Stop'

$allProcesses = Get-CimInstance Win32_Process
$byParent = @{}
foreach ($process in $allProcesses) {
    # Explicit [int] cast on both sides -- Win32_Process's own ProcessId/ParentProcessId come back
    # as UInt32, and a hashtable keyed by the wrong CLR type silently never matches (measured: an
    # untyped $byParent[$parentId] lookup against an [int] $currentId below found zero children
    # for every real process tree tested, always reporting processCount=1). Same numeric range on
    # a real machine either way (no process ever has a 2-billion-plus pid), so the cast never
    # loses information.
    $parentId = [int]$process.ParentProcessId
    $processId = [int]$process.ProcessId
    if (-not $byParent.ContainsKey($parentId)) {
        $byParent[$parentId] = New-Object System.Collections.Generic.List[int]
    }
    $byParent[$parentId].Add($processId)
}

$treeIds = New-Object System.Collections.Generic.List[int]
$queue = New-Object System.Collections.Generic.Queue[int]
$queue.Enqueue($RootProcessId)
while ($queue.Count -gt 0) {
    $currentId = $queue.Dequeue()
    if ($treeIds.Contains($currentId)) {
        continue
    }
    $treeIds.Add($currentId)
    if ($byParent.ContainsKey($currentId)) {
        foreach ($childId in $byParent[$currentId]) {
            $queue.Enqueue($childId)
        }
    }
}

$workingSetBytes = 0
$cpuSeconds = 0.0
$processCount = 0
foreach ($id in $treeIds) {
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($null -eq $proc) {
        # Gone by the time we asked -- a short-lived helper process, or the root itself already
        # exited. Skipped, not zero-filled (D-025: absence of data never becomes an affirmation --
        # this just means the tree's true total is undercounted by whatever that process was
        # using, which docs/DESEMPENHO.md's own method section says plainly).
        continue
    }
    $processCount += 1
    $workingSetBytes += $proc.WorkingSet64
    if ($null -ne $proc.CPU) {
        $cpuSeconds += $proc.CPU
    }
}

$result = [PSCustomObject]@{
    processCount    = $processCount
    workingSetBytes = $workingSetBytes
    cpuSeconds      = $cpuSeconds
}
$result | ConvertTo-Json -Compress
