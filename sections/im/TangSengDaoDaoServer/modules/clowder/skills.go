package clowder

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/TangSengDaoDao/TangSengDaoDaoServerLib/pkg/wkhttp"
)

const maxSkillUploadBytes = 2 * 1024 * 1024

var skillSlugUnsafeRE = regexp.MustCompile(`[^a-z0-9_-]+`)

type ClowderSkillSource struct {
	ID             string                      `json:"id"`
	SkillID        string                      `json:"skillId"`
	Name           string                      `json:"name"`
	DisplayName    string                      `json:"displayName"`
	Description    string                      `json:"description,omitempty"`
	Category       string                      `json:"category,omitempty"`
	Triggers       []string                    `json:"triggers,omitempty"`
	RequiresMCP    []ClowderSkillMCPDependency `json:"requiresMcp,omitempty"`
	SourceType     string                      `json:"sourceType"`
	SourceOwnerUID string                      `json:"sourceOwnerUid,omitempty"`
	Provider       string                      `json:"provider,omitempty"`
	Mounted        bool                        `json:"mounted"`
	ConflictStatus string                      `json:"conflictStatus"`
	Status         string                      `json:"status"`
	CreatedAt      int64                       `json:"createdAt"`
	UpdatedAt      int64                       `json:"updatedAt"`
}

type ClowderSkillSourceView struct {
	ClowderSkillSource
	Added bool `json:"added"`
}

type ClowderUserSkill struct {
	ID                 string   `json:"id"`
	UID                string   `json:"uid,omitempty"`
	SourceID           string   `json:"sourceId"`
	SkillID            string   `json:"skillId"`
	Name               string   `json:"name"`
	DisplayName        string   `json:"displayName"`
	Description        string   `json:"description,omitempty"`
	Category           string   `json:"category,omitempty"`
	Triggers           []string `json:"triggers,omitempty"`
	Enabled            bool     `json:"enabled"`
	AgentIDs           []string `json:"agentIds"`
	AssignedAgentCount int      `json:"assignedAgentCount"`
	SourceType         string   `json:"sourceType"`
	Provider           string   `json:"provider,omitempty"`
	AddSource          string   `json:"addSource"`
	Status             string   `json:"status"`
	CreatedAt          int64    `json:"createdAt"`
	UpdatedAt          int64    `json:"updatedAt"`
}

func (c *Clowder) skillSummary(ctx *wkhttp.Context) {
	uid := strings.TrimSpace(ctx.GetLoginUID())
	if uid == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	c.refreshSkillMarketplace(uid)
	ctx.JSON(http.StatusOK, map[string]interface{}{"skills": c.listUserSkills(uid)})
}

func (c *Clowder) userSkillList(ctx *wkhttp.Context) {
	uid := strings.TrimSpace(ctx.GetLoginUID())
	if uid == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	c.refreshSkillMarketplace(uid)
	ctx.JSON(http.StatusOK, map[string]interface{}{"skills": c.listUserSkills(uid)})
}

func (c *Clowder) skillMarketplace(ctx *wkhttp.Context) {
	uid := strings.TrimSpace(ctx.GetLoginUID())
	if uid == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	c.refreshSkillMarketplace(uid)
	ctx.JSON(http.StatusOK, map[string]interface{}{"skills": c.listSkillSources(uid)})
}

func (c *Clowder) addMarketplaceSkill(ctx *wkhttp.Context) {
	uid := strings.TrimSpace(ctx.GetLoginUID())
	sourceID := strings.TrimSpace(ctx.Param("sourceId"))
	if uid == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	if sourceID == "" {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "source_id_required"})
		return
	}
	c.refreshSkillMarketplace(uid)
	source, ok := c.getSkillSource(sourceID)
	if !ok {
		ctx.JSON(http.StatusNotFound, map[string]string{"error": "skill_source_not_found"})
		return
	}
	skill := c.addUserSkill(uid, source, "market")
	ctx.JSON(http.StatusOK, map[string]interface{}{"skill": skill})
}

func (c *Clowder) updateUserSkill(ctx *wkhttp.Context) {
	uid := strings.TrimSpace(ctx.GetLoginUID())
	userSkillID := strings.TrimSpace(ctx.Param("userSkillId"))
	if uid == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	var req struct {
		DisplayName *string  `json:"displayName"`
		Description *string  `json:"description"`
		Category    *string  `json:"category"`
		Enabled     *bool    `json:"enabled"`
		Triggers    []string `json:"triggers"`
	}
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	skill, ok := c.patchUserSkill(uid, userSkillID, req.DisplayName, req.Description, req.Category, req.Enabled, req.Triggers)
	if !ok {
		ctx.JSON(http.StatusNotFound, map[string]string{"error": "user_skill_not_found"})
		return
	}
	ctx.JSON(http.StatusOK, map[string]interface{}{"skill": skill})
}

func (c *Clowder) deleteUserSkill(ctx *wkhttp.Context) {
	uid := strings.TrimSpace(ctx.GetLoginUID())
	userSkillID := strings.TrimSpace(ctx.Param("userSkillId"))
	if uid == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	if !c.markUserSkillDeleted(uid, userSkillID) {
		ctx.JSON(http.StatusNotFound, map[string]string{"error": "user_skill_not_found"})
		return
	}
	ctx.JSON(http.StatusOK, map[string]interface{}{"ok": true})
}

func (c *Clowder) updateUserSkillAssignments(ctx *wkhttp.Context) {
	uid := strings.TrimSpace(ctx.GetLoginUID())
	userSkillID := strings.TrimSpace(ctx.Param("userSkillId"))
	if uid == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	var req struct {
		AgentIDs []string `json:"agentIds"`
	}
	if err := ctx.BindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	visible, err := c.visibleAgentIDSet(uid)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, map[string]string{"error": "agent_directory_unavailable"})
		return
	}
	for _, agentID := range uniqueSkillStrings(req.AgentIDs) {
		if !visible[agentID] {
			ctx.JSON(http.StatusBadRequest, map[string]string{"error": "agent_not_visible", "agentId": agentID})
			return
		}
	}
	skill, ok := c.setUserSkillAssignments(uid, userSkillID, req.AgentIDs)
	if !ok {
		ctx.JSON(http.StatusNotFound, map[string]string{"error": "user_skill_not_found"})
		return
	}
	ctx.JSON(http.StatusOK, map[string]interface{}{"skill": skill})
}

func (c *Clowder) uploadSkillPackage(ctx *wkhttp.Context) {
	uid := strings.TrimSpace(ctx.GetLoginUID())
	if uid == "" {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "login_required"})
		return
	}
	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "skill_zip_required"})
		return
	}
	defer file.Close()

	limited := io.LimitReader(file, maxSkillUploadBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "skill_zip_read_failed"})
		return
	}
	if len(data) > maxSkillUploadBytes {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": "skill_zip_too_large"})
		return
	}
	source, err := skillSourceFromZip(uid, header.Filename, data)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	source = c.upsertUploadedSkillSource(source)
	skill := c.addUserSkill(uid, source, "uploaded")
	ctx.JSON(http.StatusOK, map[string]interface{}{"source": source, "skill": skill})
}

func (c *Clowder) refreshSkillMarketplace(uid string) {
	directory, err := c.fetchCatDirectory(uid)
	if err != nil {
		return
	}
	c.upsertSkillCatalog(directory.SkillCatalog)
}

func (c *Clowder) upsertSkillCatalog(catalog map[string][]ClowderSkill) {
	if len(catalog) == 0 {
		return
	}
	c.skillMu.Lock()
	defer c.skillMu.Unlock()
	if c.skillSources == nil {
		c.skillSources = map[string]ClowderSkillSource{}
	}
	now := time.Now().UnixMilli()
	for provider, skills := range catalog {
		provider = strings.TrimSpace(provider)
		if provider == "" {
			provider = "all"
		}
		for _, skill := range skills {
			name := strings.TrimSpace(skill.Name)
			if name == "" {
				continue
			}
			id := skillSourceID(provider, name)
			source := c.skillSources[id]
			if source.ID == "" {
				source.ID = id
				source.SkillID = slugSkillID(name)
				source.CreatedAt = now
			}
			source.Name = name
			source.DisplayName = name
			source.Description = strings.TrimSpace(skill.Description)
			source.Category = strings.TrimSpace(skill.Category)
			source.Triggers = uniqueSkillStrings([]string{skill.Trigger})
			source.RequiresMCP = skill.RequiresMCP
			source.SourceType = "official"
			source.Provider = provider
			source.Mounted = skill.Mounted
			source.ConflictStatus = "none"
			source.Status = "active"
			source.UpdatedAt = now
			c.skillSources[id] = source
		}
	}
}

func (c *Clowder) upsertUploadedSkillSource(source ClowderSkillSource) ClowderSkillSource {
	c.skillMu.Lock()
	defer c.skillMu.Unlock()
	if c.skillSources == nil {
		c.skillSources = map[string]ClowderSkillSource{}
	}
	c.nextSkillSourceSeq++
	source.ID = fmt.Sprintf("uploaded:%s:%s:%d", source.SourceOwnerUID, source.SkillID, c.nextSkillSourceSeq)
	now := time.Now().UnixMilli()
	source.CreatedAt = now
	source.UpdatedAt = now
	source.Status = "active"
	c.skillSources[source.ID] = source
	return source
}

func (c *Clowder) getSkillSource(id string) (ClowderSkillSource, bool) {
	c.skillMu.RLock()
	defer c.skillMu.RUnlock()
	source, ok := c.skillSources[strings.TrimSpace(id)]
	return source, ok && source.Status != "deleted"
}

func (c *Clowder) listSkillSources(uid string) []ClowderSkillSourceView {
	c.skillMu.RLock()
	defer c.skillMu.RUnlock()
	added := map[string]bool{}
	for _, skill := range c.userSkills[strings.TrimSpace(uid)] {
		if skill.Status == "active" {
			added[skill.SourceID] = true
		}
	}
	result := make([]ClowderSkillSourceView, 0, len(c.skillSources))
	for _, source := range c.skillSources {
		if source.Status != "active" {
			continue
		}
		if source.SourceType == "uploaded" && source.SourceOwnerUID != "" && source.SourceOwnerUID != uid {
			continue
		}
		result = append(result, ClowderSkillSourceView{ClowderSkillSource: source, Added: added[source.ID]})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].SourceType != result[j].SourceType {
			return result[i].SourceType < result[j].SourceType
		}
		return result[i].Name < result[j].Name
	})
	return result
}

func (c *Clowder) addUserSkill(uid string, source ClowderSkillSource, addSource string) ClowderUserSkill {
	uid = strings.TrimSpace(uid)
	c.skillMu.Lock()
	defer c.skillMu.Unlock()
	if c.userSkills == nil {
		c.userSkills = map[string]map[string]ClowderUserSkill{}
	}
	if c.userSkills[uid] == nil {
		c.userSkills[uid] = map[string]ClowderUserSkill{}
	}
	for id, skill := range c.userSkills[uid] {
		if skill.SourceID == source.ID {
			if skill.Status != "active" {
				skill.Status = "active"
				skill.Enabled = true
				skill.UpdatedAt = time.Now().UnixMilli()
				c.userSkills[uid][id] = normalizeUserSkill(skill)
			}
			return c.userSkills[uid][id]
		}
	}
	c.nextUserSkillSeq++
	now := time.Now().UnixMilli()
	skill := normalizeUserSkill(ClowderUserSkill{
		ID:          fmt.Sprintf("user-skill-%d", c.nextUserSkillSeq),
		UID:         uid,
		SourceID:    source.ID,
		SkillID:     source.SkillID,
		Name:        source.Name,
		DisplayName: source.DisplayName,
		Description: source.Description,
		Category:    source.Category,
		Triggers:    source.Triggers,
		Enabled:     true,
		AgentIDs:    []string{},
		SourceType:  source.SourceType,
		Provider:    source.Provider,
		AddSource:   addSource,
		Status:      "active",
		CreatedAt:   now,
		UpdatedAt:   now,
	})
	c.userSkills[uid][skill.ID] = skill
	return skill
}

func (c *Clowder) listUserSkills(uid string) []ClowderUserSkill {
	c.skillMu.RLock()
	defer c.skillMu.RUnlock()
	result := make([]ClowderUserSkill, 0)
	for _, skill := range c.userSkills[strings.TrimSpace(uid)] {
		if skill.Status == "active" {
			result = append(result, normalizeUserSkill(skill))
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt < result[j].CreatedAt
	})
	return result
}

func (c *Clowder) patchUserSkill(uid string, id string, displayName *string, description *string, category *string, enabled *bool, triggers []string) (ClowderUserSkill, bool) {
	c.skillMu.Lock()
	defer c.skillMu.Unlock()
	skill, ok := c.userSkills[strings.TrimSpace(uid)][strings.TrimSpace(id)]
	if !ok || skill.Status != "active" {
		return ClowderUserSkill{}, false
	}
	if displayName != nil {
		skill.DisplayName = strings.TrimSpace(*displayName)
	}
	if description != nil {
		skill.Description = strings.TrimSpace(*description)
	}
	if category != nil {
		skill.Category = strings.TrimSpace(*category)
	}
	if enabled != nil {
		skill.Enabled = *enabled
	}
	if triggers != nil {
		skill.Triggers = uniqueSkillStrings(triggers)
	}
	skill.UpdatedAt = time.Now().UnixMilli()
	skill = normalizeUserSkill(skill)
	c.userSkills[uid][id] = skill
	return skill, true
}

func (c *Clowder) markUserSkillDeleted(uid string, id string) bool {
	c.skillMu.Lock()
	defer c.skillMu.Unlock()
	skill, ok := c.userSkills[strings.TrimSpace(uid)][strings.TrimSpace(id)]
	if !ok || skill.Status != "active" {
		return false
	}
	skill.Status = "deleted"
	skill.AgentIDs = []string{}
	skill.AssignedAgentCount = 0
	skill.UpdatedAt = time.Now().UnixMilli()
	c.userSkills[uid][id] = skill
	return true
}

func (c *Clowder) setUserSkillAssignments(uid string, id string, agentIDs []string) (ClowderUserSkill, bool) {
	c.skillMu.Lock()
	defer c.skillMu.Unlock()
	skill, ok := c.userSkills[strings.TrimSpace(uid)][strings.TrimSpace(id)]
	if !ok || skill.Status != "active" {
		return ClowderUserSkill{}, false
	}
	skill.AgentIDs = uniqueSkillStrings(agentIDs)
	skill.UpdatedAt = time.Now().UnixMilli()
	skill = normalizeUserSkill(skill)
	c.userSkills[uid][id] = skill
	return skill, true
}

func (c *Clowder) visibleAgentIDSet(uid string) (map[string]bool, error) {
	directory, err := c.fetchCatDirectory(uid)
	if err != nil {
		return nil, err
	}
	result := map[string]bool{}
	for _, agent := range directory.Agents {
		addVisibleAgentID(result, agent.CatID)
	}
	for _, template := range directory.Templates {
		addVisibleAgentID(result, template.CatID)
		addVisibleAgentID(result, template.RoleTemplateID)
	}
	for _, agent := range c.loadCreatedCatContacts(uid) {
		addVisibleAgentID(result, agent.CatID)
	}
	return result, nil
}

func addVisibleAgentID(result map[string]bool, value string) {
	id := strings.TrimSpace(strings.TrimPrefix(value, "clowder_cat:"))
	if id != "" {
		result[id] = true
	}
}

func normalizeUserSkill(skill ClowderUserSkill) ClowderUserSkill {
	skill.AgentIDs = uniqueSkillStrings(skill.AgentIDs)
	skill.AssignedAgentCount = len(skill.AgentIDs)
	if skill.DisplayName == "" {
		skill.DisplayName = skill.Name
	}
	if skill.Status == "" {
		skill.Status = "active"
	}
	return skill
}

func skillSourceFromZip(uid string, filename string, data []byte) (ClowderSkillSource, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return ClowderSkillSource{}, fmt.Errorf("invalid_skill_zip")
	}
	var skillMarkdown string
	for _, file := range reader.File {
		name := strings.TrimSpace(file.Name)
		if name == "" {
			continue
		}
		if err := validateSkillZipPath(name, file.FileInfo().Mode()); err != nil {
			return ClowderSkillSource{}, err
		}
		if file.FileInfo().IsDir() {
			continue
		}
		if path.Clean(strings.ReplaceAll(name, "\\", "/")) == "SKILL.md" {
			handle, err := file.Open()
			if err != nil {
				return ClowderSkillSource{}, fmt.Errorf("skill_md_read_failed")
			}
			content, err := io.ReadAll(io.LimitReader(handle, 256*1024))
			_ = handle.Close()
			if err != nil {
				return ClowderSkillSource{}, fmt.Errorf("skill_md_read_failed")
			}
			skillMarkdown = string(content)
		}
	}
	if strings.TrimSpace(skillMarkdown) == "" {
		return ClowderSkillSource{}, fmt.Errorf("skill_md_required")
	}
	name := skillNameFromMarkdown(skillMarkdown)
	if name == "" {
		name = strings.TrimSuffix(path.Base(filename), path.Ext(filename))
	}
	if name == "" {
		name = "uploaded-skill"
	}
	skillID := slugSkillID(name)
	now := time.Now().UnixMilli()
	return ClowderSkillSource{
		SkillID:        skillID,
		Name:           name,
		DisplayName:    name,
		Description:    firstSkillParagraph(skillMarkdown),
		Category:       "uploaded",
		SourceType:     "uploaded",
		SourceOwnerUID: strings.TrimSpace(uid),
		Provider:       "uploaded",
		Mounted:        false,
		ConflictStatus: "none",
		Status:         "active",
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func validateSkillZipPath(name string, mode os.FileMode) error {
	normalized := strings.ReplaceAll(strings.TrimSpace(name), "\\", "/")
	cleaned := path.Clean(normalized)
	if strings.HasPrefix(normalized, "/") || path.IsAbs(normalized) || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return fmt.Errorf("unsafe_skill_zip_path")
	}
	if mode&os.ModeSymlink != 0 {
		return fmt.Errorf("unsafe_skill_zip_symlink")
	}
	return nil
}

func skillNameFromMarkdown(markdown string) string {
	for _, line := range strings.Split(markdown, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(line, "# "))
		}
	}
	return ""
}

func firstSkillParagraph(markdown string) string {
	for _, line := range strings.Split(markdown, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		return line
	}
	return ""
}

func skillSourceID(provider string, name string) string {
	return slugSkillID(provider) + ":" + slugSkillID(name)
}

func slugSkillID(value string) string {
	cleaned := strings.ToLower(strings.TrimSpace(value))
	cleaned = strings.ReplaceAll(cleaned, " ", "-")
	cleaned = skillSlugUnsafeRE.ReplaceAllString(cleaned, "-")
	cleaned = strings.Trim(cleaned, "-")
	if cleaned == "" {
		return "skill"
	}
	return cleaned
}

func uniqueSkillStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		cleaned := strings.TrimSpace(strings.TrimPrefix(value, "clowder_cat:"))
		if cleaned == "" || seen[cleaned] {
			continue
		}
		seen[cleaned] = true
		result = append(result, cleaned)
	}
	return result
}
