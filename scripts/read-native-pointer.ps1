$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AphekaCursorReadOnly {
 [StructLayout(LayoutKind.Sequential)] public struct Point {public int x,y;}
 [StructLayout(LayoutKind.Sequential)] public struct Info {public uint size,flags;public IntPtr cursor;public Point position;}
 [DllImport("user32.dll")] public static extern bool GetCursorInfo(ref Info info);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window,uint flags);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
}
'@
$taskInfo=[AphekaCursorReadOnly+Info]::new()
$taskInfo.size=[Runtime.InteropServices.Marshal]::SizeOf($taskInfo)
if(![AphekaCursorReadOnly]::GetCursorInfo([ref]$taskInfo)){throw 'Cursor state unavailable'}
$taskUnder=[AphekaCursorReadOnly]::WindowFromPoint($taskInfo.position)
$taskForeground=[AphekaCursorReadOnly]::GetForegroundWindow()
[uint32]$taskOwner=0
[void][AphekaCursorReadOnly]::GetWindowThreadProcessId($taskForeground,[ref]$taskOwner)
@{flags=$taskInfo.flags;cursor=$taskInfo.cursor.ToInt64();x=$taskInfo.position.x;y=$taskInfo.position.y;foreground=$taskForeground.ToInt64();underRoot=[AphekaCursorReadOnly]::GetAncestor($taskUnder,2).ToInt64();foregroundProcess=(Get-Process -Id $taskOwner).Path} | ConvertTo-Json -Compress
