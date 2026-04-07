package com.slackclone.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateWorkspaceRequest(

        @NotBlank(message = "워크스페이스 이름은 필수입니다.")
        @Size(max = 100, message = "워크스페이스 이름은 100자 이하여야 합니다.")
        String name,

        @NotBlank(message = "슬러그는 필수입니다.")
        @Pattern(regexp = "^[a-z0-9-]+$", message = "슬러그는 소문자, 숫자, 하이픈만 사용할 수 있습니다.")
        @Size(max = 100, message = "슬러그는 100자 이하여야 합니다.")
        String slug,

        String description,

        String iconUrl
) {}
