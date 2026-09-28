export type GithubRepo = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  ownerAvatar: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
  description: string | null;
  language: string | null;
};

export type GithubBranch = {
  name: string;
  sha: string;
  protected: boolean;
};

export type CommitInfo = {
  sha: string;
  message: string;
  author: string;
};
