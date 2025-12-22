export const responseMessage = {
  addMessage: (fieldName: string) => `${fieldName} added successfully!`,
  uploadMessage: (fieldName: string) => `${fieldName} uploaded successfully!`,
  alreadyExists: (fieldName: string) => `${fieldName} already exists!`,
  requiredField: (fieldName: string) => `${fieldName} is required!`,
  fetchMessage: (fieldName: string) => `${fieldName} fetched successfully!`,
  updateMessage: (fieldName: string) => `${fieldName} updated successfully!`,
  deleteMessage: (fieldName: string) => `${fieldName} deleted successfully!`,
  activeMessage: (fieldName: string) => `${fieldName} activated successfully`,
  completeMessage: (fieldName: string) => `${fieldName} completed successfully`,
  deactivateMessage: (fieldName: string) =>
    `${fieldName} deactivated successfully`,
  validatedMessage: (fieldName: string) =>
    `${fieldName} validated successfully`,
  rejectedMessage: (fieldName: string) => `${fieldName} rejected successfully`,
  approvedMessage: (fieldName: string) => `${fieldName} approved successfully`,
  notFoundMessage: (fieldName: string) => `${fieldName} not found!`,
  invalidField: (fieldName: string) => `Please enter a valid ${fieldName}!`,
  errorOccurred: (fieldName: string) => `An Error occurred while ${fieldName}!`,
  login: (fieldName: string) => `${fieldName} log in successfully!`,
  logout: (fieldName: string) => `${fieldName} log out successfully!`,
  sentMessage: (fieldName: string) => `${fieldName} sent successfully!`,
  verifiedMessage: (fieldName: string) => `${fieldName} verified successfully!`,
  alreadyUsed: (fieldName: string, usedFieldName: string) =>
    `${fieldName} cannot be deleted, it has been used in ${usedFieldName}!`,
  alreadyUsedDeactivate: (fieldName: string, usedFieldName: string) =>
    `${fieldName} cannot be deactivated, it has been used in ${usedFieldName}!`,
  assignMessage: (fieldName: string) => `${fieldName} assigned successfully!`,
  returnMessage: (fieldName: string) => `${fieldName} returned successfully!`,
  sufficientBalance: () => `You do not have sufficient balance!`,
  unlimitedCredits: () => `Unlimited credits assigned cannot be returned!`,
  limitExceeds: (fieldName: string) => `${fieldName} limit Exceeds!`,
  permissionDenied: (fieldName: string) =>
    `You do not have permission to ${fieldName}!`,
  validSelection: () => `Please select at least one Entry`,
  validatedEntries: () => `Only validated entries will be pushed to review!`,
  maxEntries: (fieldName: number) => `Max ${fieldName} entries allowed!`,
  accessDenied: () => `Access Denied!`,
  errorWhileConnecting: (moduleName) => `Error while connecting ${moduleName}!`,
  generatedMessage: (fieldName: string, eWayBillNo) =>
    `${fieldName} generated successfully with ${eWayBillNo} number!`,
  generatedWithErrorMessage: (fieldName: string, errorMsg) =>
    `${fieldName} generated successfully with error ${errorMsg}!`,
  alreadyGeneratedMessage: (fieldName: string) =>
    `${fieldName} already generated!`,
  canceledMessage: (fieldName: string) => `${fieldName} canceled successfully`,
  expiredMessage: (fieldName: string) => `${fieldName} expired`,
  upgradeMessage: (fieldName: string) => `${fieldName} upgraded successfully`,
  alreadyProceed: (fieldName: string) => `${fieldName} already proceed`,
  processing: (fieldName: string) => `${fieldName} is still in process`,
  notFoundOrCanceled: (fieldName: string) =>
    `${fieldName} not found or it is canceled!`,
  internalServerError: () => `Internal server error!`,
  notFoundForGiven: (fieldName: string, givenFieldName: string) =>
    `No ${fieldName} found for the given ${givenFieldName}.`,
  notAllowed: (fieldName: string) => `${fieldName} not allowed.`,
  alreadySubscribed: (fieldName: string) =>
    `${fieldName} is already subscribed`,
  refreshSuccessfully: (fieldName: string) =>
    `${fieldName} reFreshed Successfully`,
  reUploadSuccessfully: (fieldName: string) =>
    `${fieldName} re-uploaded Successfully`,
  disposableEmail: () => `Disposable email addresses is not allowed!`,
  amountCanNotBeNegative: (fieldName: string) =>
    `${fieldName} amount cannot be negative.`,
  invalidFieldConnectorMsg: (fieldName: string) =>
    `Please ensure the ${fieldName} field contains a valid ${fieldName} before making the request.`,
  syncDataMsg: (fieldName: string) => `Please sync data before ${fieldName}`,
  noDataFoundConnectorMsg: (
    fieldName1: string,
    fieldName2: string,
    fieldName3: string,
  ) =>
    `No ${fieldName1} found for the ${fieldName2} ${fieldName3}. Please confirm the ${fieldName2} or ask the user to provide a valid one.`,
  openExe: () =>
    `Make sure accomation exe is opened or valid company is selected in tally!`,
  subscribeCompanyWithTally: () =>
    `Please subscribe company with tally before proceeding!`,
  unauthorized: () =>
    `Your session has expired or you are not authorized to perform this action. Please log in again`,
  canNotPushAgain: () =>
    `Cannot push into Tally again because it has already been pushed.`,
  canNotUpdateDeactivate: (fieldName: string) =>
    `Cannot update deactivated ${fieldName}.`,
  overlapWith: (fieldName1: string, fieldName2: string) =>
    `${fieldName1} overlaps with existing ${fieldName2}.`,
  alreadySyncedWithTally: (fieldName: string) =>
    `Cannot delete this ${fieldName} because it is already synced with Tally.`,
};
