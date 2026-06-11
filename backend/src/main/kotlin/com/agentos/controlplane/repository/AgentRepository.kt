package com.agentos.controlplane.repository

import com.agentos.controlplane.model.Agent
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID
import org.springframework.stereotype.Repository

@Repository
interface AgentRepository : JpaRepository<Agent, UUID> {
    fun findByName(name: String): Agent?
}
