job "facility-deploy-live-goerli" {
    datacenters = ["ator-fin"]
    type = "batch"

    reschedule {
        attempts = 0
    }

    task "deploy-facility-live-task" {
        driver = "docker"

        config {
            network_mode = "host"
            image = "ghcr.io/ator-development/facilitator:0.4.17"
            entrypoint = ["npx"]
            command = "hardhat"
            args = ["run", "--network", "goerli", "scripts/deploy.ts"]
        }

        vault {
            policies = ["facilitator-live-goerli"]
        }

        template {
            data = <<EOH
            {{with secret "kv/facilitator/goerli/live"}}
                DEPLOYER_PRIVATE_KEY="{{.Data.data.DEPLOYER_PRIVATE_KEY}}"
                CONSUL_TOKEN="{{.Data.data.CONSUL_TOKEN}}"
                JSON_RPC="{{.Data.data.JSON_RPC}}"
                FACILITY_OPERATOR_ADDRESS="{{.Data.data.FACILITY_OPERATOR_ADDRESS}}"
            {{end}}
            EOH
            destination = "secrets/file.env"
            env         = true
        }

        env {
            PHASE="live"
            CONSUL_IP="127.0.0.1"
            CONSUL_PORT="8500"
            FACILITY_CONSUL_KEY="facilitator/goerli/live/address"
            ATOR_TOKEN_CONSUL_KEY="ator-token/goerli/live/address"
        }

        restart {
            attempts = 0
            mode = "fail"
        }

        resources {
            cpu    = 4096
            memory = 4096
        }
    }
}
