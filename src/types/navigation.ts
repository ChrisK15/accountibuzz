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
  JoinGroup: { inviteCode?: string };
  ConfigureChallenge: { groupId: string };
  ManageMembers: { groupId: string };
  GroupSettings: { groupId: string };
  Leaderboard: { groupId: string };
  CompletionBoard: { groupId: string };
  SubmitChoice: { groupId: string };
  Camera: { groupId: string; mode: 'video' | 'photo' };
  SubmissionPreview: { groupId: string; localUri: string; mediaType: 'photo' | 'video' };
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  NotificationSettings: undefined;
};

export type AdminStackParamList = {
  AdminHome: undefined;
  ReviewQueue: { groupId: string; groupName: string };
  ReviewDetail: { submissionId: string; groupId: string };
};

export type MainTabParamList = {
  HomeTab: undefined;
  ProfileTab: undefined;
  AdminTab: undefined;
};
