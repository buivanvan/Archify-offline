function unavailable(reason) {
  return { status: 'unavailable', installedVersion: null, availableVersion: null,
    releaseNotes: null, checkedAt: null, source: null, noticeRequired: false,
    noticeText: null, reason };
}

export async function startDeliveryUpdateCheck() {
  return unavailable('disabled');
}
