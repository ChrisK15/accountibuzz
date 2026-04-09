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

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  NotificationSettings: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  ProfileTab: undefined;
};
