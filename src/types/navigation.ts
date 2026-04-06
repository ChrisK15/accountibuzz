export type AuthStackParamList = {
  Welcome: undefined;
  Register: undefined;
  SignIn: undefined;
  SetupProfile: undefined;
};

export type HomeStackParamList = {
  GroupList: undefined;
  GroupDetail: { groupId: string };
  CreateGroup: undefined;
  InviteLink: { groupId: string };
  JoinGroup: { inviteCode: string };
  ConfigureChallenge: { groupId: string };
  ManageMembers: { groupId: string };
  GroupSettings: { groupId: string };
  Leaderboard: { groupId: string };
  CompletionBoard: { groupId: string };
};
