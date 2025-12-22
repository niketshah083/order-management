export class FileConstants {
  static FILE_EXTENSION = {
    PDF: '.pdf',
    XLSX: '.xlsx',
    JPG: '.jpg',
    JPEG: '.jpeg',
    PNG: '.png',
    CSV: '.csv',
    XLS: '.xls',
    XML: '.xml',
    MP4: '.mp4',
    AVI: '.avi',
    MOV: '.mov',
    MKV: '.mkv',
  };

  static FILE_TYPE = {
    IMAGE: [FileConstants.FILE_EXTENSION.JPEG, FileConstants.FILE_EXTENSION.JPG, FileConstants.FILE_EXTENSION.PNG],
    EXCEL: [FileConstants.FILE_EXTENSION.XLSX, FileConstants.FILE_EXTENSION.XLS, FileConstants.FILE_EXTENSION.CSV],
    PDF: [FileConstants.FILE_EXTENSION.PDF],
    XML: [FileConstants.FILE_EXTENSION.XML],
    VIDEO: [FileConstants.FILE_EXTENSION.MP4, FileConstants.FILE_EXTENSION.AVI, FileConstants.FILE_EXTENSION.MOV, FileConstants.FILE_EXTENSION.MKV],
  };

  static FILE_SIZE = {
    TEN_MB: 10 * 1024 * 1024,
  };
}
