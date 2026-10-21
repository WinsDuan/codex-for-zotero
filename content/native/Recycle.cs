using System;
using System.IO;
using System.Runtime.InteropServices;
namespace CodexZotero {
 [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IShellItem {
  void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
  void GetParent(out IShellItem parent);
  void GetDisplayName(uint sigdn, out IntPtr name);
  void GetAttributes(uint mask, out uint attrs);
  void Compare(IShellItem other, uint hint, out int order);
 }
 [ComImport, Guid("947AAB5F-0A5C-4C13-B4D6-4BF7836FC9F8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IFileOperation {
  void Advise(IFileOperationProgressSink sink, out uint cookie);
  void Unadvise(uint cookie);
  void SetOperationFlags(uint flags);
  void SetProgressMessage([MarshalAs(UnmanagedType.LPWStr)] string message);
  void SetProgressDialog(IntPtr dialog);
  void SetProperties(IntPtr props);
  void SetOwnerWindow(IntPtr owner);
  void ApplyPropertiesToItem(IShellItem item);
  void ApplyPropertiesToItems(IntPtr items);
  void RenameItem(IShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name, IFileOperationProgressSink sink);
  void RenameItems(IntPtr items, [MarshalAs(UnmanagedType.LPWStr)] string name);
  void MoveItem(IShellItem item, IShellItem dest, [MarshalAs(UnmanagedType.LPWStr)] string name, IFileOperationProgressSink sink);
  void MoveItems(IntPtr items, IShellItem dest);
  void CopyItem(IShellItem item, IShellItem dest, [MarshalAs(UnmanagedType.LPWStr)] string name, IFileOperationProgressSink sink);
  void CopyItems(IntPtr items, IShellItem dest);
  void DeleteItem(IShellItem item, IFileOperationProgressSink sink);
  void DeleteItems(IntPtr items);
  void NewItem(IShellItem dest, uint attrs, [MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.LPWStr)] string template, IFileOperationProgressSink sink);
  void PerformOperations();
  void GetAnyOperationsAborted([MarshalAs(UnmanagedType.Bool)] out bool aborted);
 }
 [ComVisible(true), Guid("04B0F1A7-9490-44BC-96E1-4296A31252E2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IFileOperationProgressSink {
  [PreserveSig] int StartOperations();
  [PreserveSig] int FinishOperations(int result);
  [PreserveSig] int PreRenameItem(uint flags, IShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name);
  [PreserveSig] int PostRenameItem(uint flags, IShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IShellItem created);
  [PreserveSig] int PreMoveItem(uint flags, IShellItem item, IShellItem dest, [MarshalAs(UnmanagedType.LPWStr)] string name);
  [PreserveSig] int PostMoveItem(uint flags, IShellItem item, IShellItem dest, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IShellItem created);
  [PreserveSig] int PreCopyItem(uint flags, IShellItem item, IShellItem dest, [MarshalAs(UnmanagedType.LPWStr)] string name);
  [PreserveSig] int PostCopyItem(uint flags, IShellItem item, IShellItem dest, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IShellItem created);
  [PreserveSig] int PreDeleteItem(uint flags, IShellItem item);
  [PreserveSig] int PostDeleteItem(uint flags, IShellItem item, int result, IShellItem created);
  [PreserveSig] int PreNewItem(uint flags, IShellItem dest, [MarshalAs(UnmanagedType.LPWStr)] string name);
  [PreserveSig] int PostNewItem(uint flags, IShellItem dest, [MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.LPWStr)] string template, uint attrs, int result, IShellItem created);
  [PreserveSig] int UpdateProgress(uint total, uint done);
  [PreserveSig] int ResetTimer();
  [PreserveSig] int PauseTimer();
  [PreserveSig] int ResumeTimer();
 }
 [ComVisible(true), ClassInterface(ClassInterfaceType.None)]
 public class Sink : IFileOperationProgressSink {
  public string RecycledPath;
  public int Error;
  public bool RequireRecycle;
  public int StartOperations(){return 0;}
  public int FinishOperations(int r){if(r<0)Error=r;return 0;}
  public int PreRenameItem(uint f,IShellItem i,string n){return 0;}
  public int PostRenameItem(uint f,IShellItem i,string n,int r,IShellItem c){return 0;}
  public int PreMoveItem(uint f,IShellItem i,IShellItem d,string n){return 0;}
  public int PostMoveItem(uint f,IShellItem i,IShellItem d,string n,int r,IShellItem c){if(r<0)Error=r;return 0;}
  public int PreCopyItem(uint f,IShellItem i,IShellItem d,string n){return 0;}
  public int PostCopyItem(uint f,IShellItem i,IShellItem d,string n,int r,IShellItem c){return 0;}
  // TSF_DELETE_RECYCLE_IF_POSSIBLE (0x80) must be present. Refuse any permanent fallback.
  public int PreDeleteItem(uint f,IShellItem i){return RequireRecycle && (f & 0x80)==0 ? unchecked((int)0x80004004) : 0;}
  public int PostDeleteItem(uint f,IShellItem i,int r,IShellItem c){if(r<0){Error=r;return 0;}if(c!=null){IntPtr p;c.GetDisplayName(0x80028000,out p);try{RecycledPath=Marshal.PtrToStringUni(p);}finally{Marshal.FreeCoTaskMem(p);}}return 0;}
  public int PreNewItem(uint f,IShellItem d,string n){return 0;}
  public int PostNewItem(uint f,IShellItem d,string n,string t,uint a,int r,IShellItem c){return 0;}
  public int UpdateProgress(uint t,uint d){return 0;}
  public int ResetTimer(){return 0;}
  public int PauseTimer(){return 0;}
  public int ResumeTimer(){return 0;}
 }
 public static class Recycle {
  public static void Validate(string path,string root){
   path=Path.GetFullPath(path);root=Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar);
   if(!path.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new IOException("Path is outside the conversation folder.");
   if(!File.Exists(path)||Directory.Exists(path))throw new IOException("Only regular files are allowed.");
   string cursor=path;while(!String.IsNullOrEmpty(cursor)){if((File.GetAttributes(cursor)&FileAttributes.ReparsePoint)!=0)throw new IOException("Symbolic links, junctions and reparse points are excluded.");cursor=Path.GetDirectoryName(cursor);}
  }
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, PreserveSig=false)] static extern void SHCreateItemFromParsingName(string path,IntPtr pbc,ref Guid iid,out IShellItem item);
  static IShellItem Item(string path){Guid iid=typeof(IShellItem).GUID;IShellItem i;SHCreateItemFromParsingName(path,IntPtr.Zero,ref iid,out i);return i;}
  static IFileOperation Operation(){return (IFileOperation)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("3AD05575-8857-4850-9277-11B85BDB8E09")));}
  static void Check(IFileOperation op,Sink sink){op.PerformOperations();bool aborted;op.GetAnyOperationsAborted(out aborted);if(sink.Error<0)Marshal.ThrowExceptionForHR(sink.Error);if(aborted)throw new IOException("Windows canceled the operation; no permanent-delete fallback is used.");}
  public static string Delete(string path){
   path=Path.GetFullPath(path);if(!File.Exists(path)||Directory.Exists(path))throw new IOException("Only an existing regular file can be recycled.");
   if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new IOException("Reparse points are excluded.");
   if(new Uri(path).IsUnc)throw new IOException("Recycle Bin cleanup is available for local disks only.");
   var op=Operation();var sink=new Sink{RequireRecycle=true};var item=Item(path);
   try{op.SetOperationFlags(0x00080000|0x20000000|0x00100000|0x0400|0x2000|0x0004);op.DeleteItem(item,sink);Check(op,sink);if(String.IsNullOrEmpty(sink.RecycledPath))throw new IOException("Windows did not return a restorable Recycle Bin item.");return sink.RecycledPath;}
   finally{Marshal.ReleaseComObject(item);Marshal.ReleaseComObject(op);}
  }
  public static void Restore(string recyclePath,string destination){
   destination=Path.GetFullPath(destination);if(File.Exists(destination)||Directory.Exists(destination))throw new IOException("Destination already exists; it was not overwritten.");
   var op=Operation();var sink=new Sink();var item=Item(recyclePath);var parent=Item(Path.GetDirectoryName(destination));
   try{op.SetOperationFlags(0x00100000|0x0400|0x0004|0x2000);op.MoveItem(item,parent,Path.GetFileName(destination),sink);Check(op,sink);if(!File.Exists(destination))throw new IOException("Restore did not complete.");}
   finally{Marshal.ReleaseComObject(item);Marshal.ReleaseComObject(parent);Marshal.ReleaseComObject(op);}
  }
 }
}
